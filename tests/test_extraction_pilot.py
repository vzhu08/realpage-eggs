import json
from decimal import Decimal

import httpx
import pytest

from navigator.extraction import OpenAIProvider, ProviderFailure
from navigator.models import SourceDocument
from navigator.store import Store, digest
from scripts.extraction_pilot import PilotClient, MODEL, configure_credentials, main, plan


def provider(tmp_path, monkeypatch, handler, budget=5):
    monkeypatch.setenv("OPENAI_API_KEY", "synthetic-test-key")
    monkeypatch.setenv("OPENAI_MODEL", MODEL)
    client = PilotClient(httpx.Client(transport=httpx.MockTransport(handler)),
                         tmp_path / "budget.json", budget)
    return OpenAIProvider(client=client), client


@pytest.mark.parametrize("failure", ["timeout", "http500", "http429"])
def test_transport_or_http_failure_is_never_retried(tmp_path, monkeypatch, failure):
    calls = []
    def handle(request):
        calls.append(request)
        if failure == "timeout":
            raise httpx.ReadTimeout("synthetic transport failure")
        return httpx.Response(int(failure[4:]))
    api, client = provider(tmp_path, monkeypatch, handle)
    with pytest.raises(ProviderFailure):
        api.generate("JSON", {})
    with pytest.raises(ProviderFailure):
        api.generate("JSON", {})
    assert len(calls) == 1
    ledger = json.loads(client.path.read_text())
    assert ledger["reserved_usd"] == "1.50"
    assert "synthetic-test-key" not in client.path.read_text()
    client.close()


def test_allowance_reserved_before_io_and_fourth_request_blocked(tmp_path, monkeypatch):
    calls = []
    def handle(request):
        ledger = json.loads((tmp_path / "budget.json").read_text())
        assert ledger["requests"][-1]["status"] == "in_flight"
        assert Decimal(ledger["reserved_usd"]) == Decimal("1.5") * (len(calls) + 1)
        assert json.loads(request.content)["service_tier"] == "default"
        calls.append(request)
        return httpx.Response(200, json={"status": "completed", "output": [{"content": [{"type": "output_text", "text": "{}"}]}]})
    api, client = provider(tmp_path, monkeypatch, handle)
    for _ in range(3):
        assert api.generate("JSON", {}) == {}
    with pytest.raises(ProviderFailure, match="limit"):
        api.generate("JSON", {})
    assert len(calls) == 3
    client.close()


def test_budget_and_size_block_before_network(tmp_path, monkeypatch):
    calls = []
    api, client = provider(tmp_path, monkeypatch, lambda request: calls.append(request), budget=1)
    with pytest.raises(ProviderFailure, match="budget"):
        api.generate("JSON", {})
    assert not calls
    client.budget = Decimal("5")
    with pytest.raises(ProviderFailure, match="size"):
        api.generate("JSON", {"text": "x" * 131072})
    assert not calls and not client.ledger["requests"]
    client.close()


def test_dry_run_and_input_guards_never_touch_source_or_create_output(tmp_path, monkeypatch):
    source, output = tmp_path / "source", tmp_path / "output"
    store = Store(source)
    text = "SYNTHETIC TEST CONTENT: non-production fixture for dry-run guards only."
    document = SourceDocument(doc_id="TEST", jurisdictions=["CA"], url="https://example.invalid/synthetic",
                              retrieved_at="2026-10-04T00:00Z", text=text, sha256=digest(text.encode()),
                              capture_status="supplementary", authority="official")  # Eligible metadata shape only.
    store.save_collection("sources", {"TEST": document})
    original = store.path("sources.json").read_bytes()
    def forbidden(*args, **kwargs):
        pytest.fail("dry-run must not construct a provider")
    monkeypatch.setattr("scripts.extraction_pilot.OpenAIProvider", forbidden)
    assert main(["--source-dir", str(source), "--output", str(output), "--doc-id", "TEST"]) == 0
    assert not output.exists() and store.path("sources.json").read_bytes() == original
    with pytest.raises(ValueError, match="non-nested"):
        plan(source, source / "child", "TEST")
    output.mkdir()
    with pytest.raises(ValueError, match="already exists"):
        plan(source, output, "TEST")
    document.text = "x" * 18001
    document.sha256 = digest(document.text.encode())
    store.save_collection("sources", {"TEST": document})
    with pytest.raises(ValueError, match="one chunk"):
        plan(source, tmp_path / "new", "TEST")


def test_existing_ledger_cannot_be_reused(tmp_path):
    path = tmp_path / "budget.json"
    path.write_text('{"requests": [{"status": "in_flight"}]}')
    with httpx.Client() as client:
        with pytest.raises(ValueError, match="Existing budget ledger"):
            PilotClient(client, path, 5)


def test_execute_uses_core_in_a_new_copy_with_mocked_api(demo, tmp_path, monkeypatch):
    from navigator.demo import synthetic_bundle
    source = next(iter(demo.sources().values()))
    # Synthetic content stays in a test-only temp store; exercise the real-source preflight shape.
    source.capture_status = "supplementary"
    source.authority = "official"  # Mock the eligible provenance shape; no real source/provider is used.
    demo.save_collection("sources", {source.doc_id: source})
    before = {p.relative_to(demo.root): p.read_bytes() for p in demo.root.rglob("*") if p.is_file()}
    calls = []
    def handle(request):
        calls.append(request)
        return httpx.Response(200, json={"id": "synthetic-response", "model": MODEL,
            "status": "completed", "usage": {"input_tokens": 1, "output_tokens": 1},
            "output": [{"content": [{"type": "output_text", "text": json.dumps(synthetic_bundle(source))}]}]})
    real_client = httpx.Client
    monkeypatch.setattr("scripts.extraction_pilot.httpx.Client",
                        lambda **kwargs: real_client(transport=httpx.MockTransport(handle), **kwargs))
    monkeypatch.setenv("OPENAI_API_KEY", "synthetic-test-only")
    monkeypatch.setenv("OPENAI_MODEL", MODEL)
    output = tmp_path / "pilot"
    assert main(["--source-dir", str(demo.root), "--output", str(output),
                 "--doc-id", source.doc_id, "--execute"]) == 0
    assert len(calls) == 2
    assert before == {p.relative_to(demo.root): p.read_bytes() for p in demo.root.rglob("*") if p.is_file()}
    run = Store(output).read("latest_extract.json")
    assert run["outcome"] == "success" and run["config"]["transport_attempts"] == 1
    assert len(Store(output).read("pilot_budget.json")["requests"]) == 2


def test_explicit_env_selects_project_and_never_falls_back(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "synthetic-other-project")
    monkeypatch.setenv("OPENAI_MODEL", "synthetic-other-model")
    path = tmp_path / ".env"
    path.write_text("OPENAI_API_KEY=synthetic-selected-project\n")
    configure_credentials(path)
    import os
    assert os.environ["OPENAI_API_KEY"] == "synthetic-selected-project"
    assert os.environ["OPENAI_MODEL"] == MODEL
    path.write_text("OPENAI_MODEL=synthetic-other-model\n")
    with pytest.raises(ValueError, match="refusing fallback"):
        configure_credentials(path)


@pytest.mark.parametrize("budget", ["NaN", "Infinity", "-1", "0", "5.01"])
def test_invalid_budget_rejected_before_io(tmp_path, budget):
    with httpx.Client() as client:
        with pytest.raises(ValueError, match="budget"):
            PilotClient(client, tmp_path / "budget.json", budget)
    assert not (tmp_path / "budget.json").exists()
