"""Focused runner isolation, source identity and explicit-context handoff checks."""
import json
from types import SimpleNamespace

import pytest

from navigator.models import SourceDocument
from navigator.store import Store, digest, write_json
from scripts import extract_change_cases as runner


@pytest.fixture
def inputs(tmp_path):
    base, bundle = tmp_path / "base", tmp_path / "bundle"
    primary = SourceDocument(doc_id="TEST-PRIMARY", jurisdictions=["CA"],
        url="https://example.test/legal", retrieved_at="2026-10-01T00:00:00Z",
        text="Fictional primary text for transport tests only.", sha256="", authority="official",
        capture_status="supplementary", source_type="legal_text")
    primary.sha256 = digest(primary.text.encode())
    support = primary.model_copy(update={"doc_id": "TEST-STATUS", "source_type": "status_record",
        "text": "Fictional status text for transport tests only.", "url": "https://example.test/status"})
    support.sha256 = digest(support.text.encode())
    Store(base).save_collection("sources", {primary.doc_id: primary})
    Store(base).write("rules.json", {})
    Store(base).write("dataset.json", {"mode": "synthetic", "label": "runner tests"})
    (base / ".env").write_text("TEST_SECRET=must-not-copy\n")
    Store(bundle).save_collection("sources", {s.doc_id: s for s in (primary, support)})
    documents = []
    for source in (primary, support):
        path = bundle / f"{source.doc_id}.txt"
        path.write_text(source.text)
        documents.append({"doc_id": source.doc_id, "text_sha256": source.sha256,
            "original_source_metadata": source.model_dump(exclude={"text"}),
            "declaration": {"source_type": source.source_type}, "provenance": {},
            "files": [{"path": path.name, "sha256": digest(path.read_bytes()), "bytes": path.stat().st_size}]})
    manifest = {"label": "SOURCE_ONLY_RESEARCH_BUNDLE_NOT_A_SUBMISSION", "rules_created": 0,
        "provider_calls": 0, "sources_json_sha256": digest((bundle / "sources.json").read_bytes()),
        "documents": documents, "extraction_jobs": [{"doc_id": primary.doc_id,
            "supporting_doc_ids": [support.doc_id]}]}
    write_json(bundle / "manifest.json", manifest)
    return base, bundle, tmp_path / "output"


def snapshot(root):
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()}


def test_dry_run_preserves_inputs_no_credentials_network_or_writes(inputs, monkeypatch):
    base, bundle, output = inputs
    before = snapshot(base), snapshot(bundle)
    monkeypatch.setattr(runner, "configure_credentials", lambda _: pytest.fail("credentials accessed"))
    monkeypatch.setattr(runner.httpx, "Client", lambda **kw: pytest.fail("network initialized"))
    assert runner.main(["--source-dir", str(base), "--source-bundle", str(bundle), "--output", str(output)]) == 0
    assert not output.exists() and before == (snapshot(base), snapshot(bundle))
    details = runner.plan(*inputs)
    assert details["jobs"][0]["supporting_doc_ids"] == ["TEST-STATUS"]
    assert details["max_requests_before_budget_limit"] == 3
    assert ".env" not in details["input_files_sha256"]["base_store"]
    assert details["jobs"][0]["request_sizes"]["review_draft_headroom_bytes"] > 16384


@pytest.mark.parametrize("text", ["x" * 108000, "界" * 50000])
def test_request_sizing_rejects_too_little_review_space_without_network(inputs, monkeypatch, text):
    _, bundle, _ = inputs
    sources = Store(bundle).sources()
    support = sources["TEST-STATUS"].model_copy(update={"text": text})
    monkeypatch.setattr(runner.httpx, "Client", lambda **kw: pytest.fail("network initialized"))
    with pytest.raises(ValueError, match="request/review space"):
        runner.request_sizes(sources["TEST-PRIMARY"], [support])


@pytest.mark.parametrize("tamper", ["payload", "sources", "existing_source"])
def test_changed_evidence_refused_before_output(inputs, tamper):
    base, bundle, output = inputs
    if tamper == "payload":
        (bundle / "TEST-PRIMARY.txt").write_text("Changed capture")
    elif tamper == "sources":
        with (bundle / "sources.json").open("a") as stream:
            stream.write(" ")
    else:
        sources = Store(base).sources()
        sources["TEST-PRIMARY"].text = "Different retained evidence"
        Store(base).save_collection("sources", sources)
    with pytest.raises(ValueError, match="changed|mismatch|different evidence"):
        runner.plan(*inputs)
    assert not output.exists()


@pytest.mark.parametrize("edit", ["unknown", "overlap", "duplicate", "status_primary", "news_context"])
def test_context_cannot_silently_expand_or_promote_status(inputs, edit):
    base, bundle, output = inputs
    manifest = json.loads((bundle / "manifest.json").read_text())
    job = manifest["extraction_jobs"][0]
    if edit == "unknown": job["supporting_doc_ids"] = ["UNKNOWN"]
    elif edit == "overlap": job["supporting_doc_ids"] = ["TEST-PRIMARY"]
    elif edit == "duplicate": job["supporting_doc_ids"] *= 2
    elif edit == "status_primary": job.update(doc_id="TEST-STATUS", supporting_doc_ids=[])
    else:
        sources = Store(bundle).sources()
        sources["TEST-STATUS"].source_type = "news"
        Store(bundle).save_collection("sources", sources)
        manifest["sources_json_sha256"] = digest((bundle / "sources.json").read_bytes())
    write_json(bundle / "manifest.json", manifest)
    with pytest.raises(ValueError): runner.plan(*inputs)
    assert not output.exists()


def test_duplicate_json_and_symlink_refused(inputs):
    base, bundle, output = inputs
    (base / "rules.json").write_text('{"duplicate":{},"duplicate":{}}')
    with pytest.raises(ValueError, match="Duplicate JSON"): runner.plan(*inputs)
    (base / "rules.json").write_text('{}')
    (base / "linked").symlink_to(bundle / "manifest.json")
    with pytest.raises(ValueError, match="Symlinks"): runner.plan(*inputs)
    assert not output.exists()


@pytest.mark.parametrize("tamper", ["internal_id", "base_authority", "undeclared_bundle_authority"])
def test_metadata_changes_need_matching_provenance(inputs, tamper):
    base, bundle, _ = inputs
    selected = base if tamper == "base_authority" else bundle
    sources = Store(selected).sources()
    source = sources["TEST-PRIMARY"]
    if tamper == "internal_id": source.doc_id = "OTHER-INTERNAL-ID"
    else: source.authority = "secondary"
    Store(selected).save_collection("sources", sources)
    if selected == bundle:
        manifest = json.loads((bundle / "manifest.json").read_text())
        manifest["sources_json_sha256"] = digest((bundle / "sources.json").read_bytes())
        write_json(bundle / "manifest.json", manifest)
    with pytest.raises(ValueError, match="map keys|metadata"):
        runner.plan(*inputs)


@pytest.mark.parametrize("choice", [["UNKNOWN"], [], ["TEST-PRIMARY", "TEST-PRIMARY"]])
def test_unknown_or_duplicate_subset_refused(inputs, choice):
    with pytest.raises(ValueError, match="unique primary"): runner.plan(*inputs, doc_ids=choice)


@pytest.mark.parametrize("outcome", ["success", "failed"])
def test_execution_hands_explicit_context_to_core_in_private_copy(inputs, monkeypatch, outcome):
    base, bundle, output = inputs
    before = snapshot(base), snapshot(bundle)
    calls = []
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    monkeypatch.setattr(runner, "configure_credentials", lambda _: None)
    monkeypatch.setattr(runner, "OpenAIProvider", lambda **kw: SimpleNamespace(**kw))
    def fake_extract(store, docs, *, provider, limit, supporting_doc_ids):
        calls.append((store.root, docs, supporting_doc_ids, limit))
        assert not store.path(".env").exists()
        assert "TEST-STATUS" in store.sources()
        run = store.new_run("extract", "synthetic")
        return store.finish(run, outcome)
    monkeypatch.setattr(runner, "extract", fake_extract)
    code = runner.main(["--source-dir", str(base), "--source-bundle", str(bundle),
        "--output", str(output), "--budget-usd", "2", "--execute"])
    assert code == (0 if outcome == "success" else 1)
    assert calls == [(output, ["TEST-PRIMARY"], ["TEST-STATUS"], 1)]
    assert before == (snapshot(base), snapshot(bundle))
    assert (output / "change_case_source_bundle/manifest.json").read_bytes() == (bundle / "manifest.json").read_bytes()
    assert Store(output).read("change_case_budget.json")["requests"] == []
    assert output.stat().st_mode & 0o077 == 0


def test_execute_requires_explicit_budget_before_credentials(inputs, monkeypatch):
    monkeypatch.setattr(runner, "configure_credentials", lambda _: pytest.fail("credentials accessed"))
    with pytest.raises(SystemExit):
        runner.main(["--source-dir", str(inputs[0]), "--source-bundle", str(inputs[1]),
                     "--output", str(inputs[2]), "--execute"])
    assert not inputs[2].exists()


def test_mutation_during_copy_stops_before_provider(inputs, monkeypatch):
    base, bundle, output = inputs
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    monkeypatch.setattr(runner, "configure_credentials", lambda _: None)
    monkeypatch.setattr(runner, "OpenAIProvider", lambda **kw: pytest.fail("provider initialized"))
    original_copy = runner.shutil.copytree
    def changed_copy(source, destination, *args, **kwargs):
        result = original_copy(source, destination, *args, **kwargs)
        if destination == output:
            (output / "rules.json").write_text("{} ")
        return result
    monkeypatch.setattr(runner.shutil, "copytree", changed_copy)
    with pytest.raises(ValueError, match="Copied base Store"):
        runner.main(["--source-dir", str(base), "--source-bundle", str(bundle),
            "--output", str(output), "--budget-usd", "2", "--execute"])
