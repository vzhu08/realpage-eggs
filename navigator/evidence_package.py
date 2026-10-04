"""Property evidence downloads and offline replay through the existing assist service."""
from copy import deepcopy
from importlib.metadata import version
import json
import os
from pathlib import Path
import platform
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from .assist_service import assist, core_module, CoreUnavailable
from .config import DISCLAIMER, ROOT, VERSION
from .evidence import semantic_key
from .models import (EvidenceCodeVersion, EvidencePackage, EvidencePackageInputs,
                     EvidencePackageRequest, EvidenceReplayResult, JurisdictionResolution,
                     PropertyFacts, Rule, SemanticReview, SourceDocument)
from .service import DatasetUnavailable
from .store import Store, digest, write_json


class PackageStore(Store):
    """Only the selected original property and the recorded legal inputs are readable."""
    def __init__(self, inputs):
        values = inputs.model_dump(mode="json")
        for name in ("rules", "sources", "extraction_index"):
            values[name] = dict(sorted(values[name].items()))
        self.values = {"addresses.json": {inputs.original_property.address_id: values["original_property"]},
                       "resolutions.json": {inputs.jurisdiction.address_id: values["jurisdiction"]},
                       **{f"{name}.json": values[name] for name in ("rules", "sources", "dataset", "extraction_index")},
                       **{f"semantic_reviews/{key}.json": value for key, value in values["semantic_reviews"].items()}}

    def read(self, name, default=None):
        return deepcopy(self.values.get(name, default))

    def path(self, name):
        raise RuntimeError("Evidence package replay has no filesystem store")

    def write(self, name, value):
        raise RuntimeError("Evidence package inputs are read-only")


def code_version():
    paths = list((ROOT / "navigator").glob("*.py")) + [ROOT / "requirements.lock"]
    files = {p.relative_to(ROOT).as_posix(): digest(p.read_bytes().replace(b"\r\n", b"\n")) for p in sorted(paths)}
    dependencies = {name: version(name) for name in ("pydantic", "pydantic_core", "fastapi", "starlette", "httpx", "jsonschema", "python-dotenv")}
    values = {"pipeline_version": VERSION, "python_version": platform.python_version(),
              "dependencies": dependencies, "files_sha256": files}
    return EvidenceCodeVersion(**values, fingerprint=digest(values))


def capture_inputs(store, request):
    captured = {}

    def capture(name, default):
        path = store.path(name)
        raw = path.read_bytes() if path.exists() else None
        captured[name] = raw
        return json.loads(raw) if raw is not None else default

    addresses = capture("addresses.json", {})
    if not addresses:
        raise DatasetUnavailable("Dataset absent; run navigator ingest")
    if request.address_id not in addresses:
        raise KeyError(f"Unknown address ID {request.address_id}")
    prop = PropertyFacts.model_validate(addresses[request.address_id])
    resolutions = capture("resolutions.json", {})
    jurisdiction = JurisdictionResolution.model_validate(resolutions[request.address_id]) if request.address_id in resolutions else JurisdictionResolution(address_id=prop.address_id, state=prop.raw_address.state)
    rules = {key: Rule.model_validate(value) for key, value in capture("rules.json", {}).items()}
    sources = {key: SourceDocument.model_validate(value) for key, value in capture("sources.json", {}).items()}
    index = capture("extraction_index.json", {})
    dataset = capture("dataset.json", {})
    # Do not include local pack paths or arbitrary deployment configuration.
    dataset = {key: dataset[key] for key in ("mode", "label", "input_hashes", "ingest_run_id") if key in dataset}
    reviews = {}
    for rule in rules.values():
        key = semantic_key(rule, sources)
        value = capture(f"semantic_reviews/{key}.json", None)
        if value is not None:
            reviews[key] = SemanticReview.model_validate(value)
    inputs = EvidencePackageInputs(original_property=prop, jurisdiction=jurisdiction, rules=rules,
                                   sources=sources, extraction_index=index, dataset=dataset, semantic_reviews=reviews)
    check_input_ids(inputs, request)
    for name, raw in captured.items():
        path = store.path(name)
        current = path.read_bytes() if path.exists() else None
        if current != raw:
            raise DatasetUnavailable("Dataset changed while packaging; retry against a stable snapshot")
    return inputs


def check_input_ids(inputs, request):
    if request.address_id != inputs.original_property.address_id or request.address_id != inputs.jurisdiction.address_id:
        raise ValueError("Package property/jurisdiction IDs do not match the request")
    if any(key != rule.team_rule_id for key, rule in inputs.rules.items()):
        raise ValueError("Package rule IDs do not match their keys")
    if any(key != source.doc_id for key, source in inputs.sources.items()):
        raise ValueError("Package source IDs do not match their keys")


def artifact_label(inputs):
    synthetic = (inputs.dataset.get("mode") == "synthetic"
                 or any(r.evidence_mode == "synthetic" for r in inputs.rules.values())
                 or any(s.capture_status == "synthetic" for s in inputs.sources.values()))
    return "SYNTHETIC_NOT_FOR_SUBMISSION" if synthetic else "RESEARCH_EVIDENCE_NOT_LEGAL_VALIDATION"


def package_digest(package):
    return digest(package.model_dump(mode="json", exclude={"package_sha256"}))


def build_evidence_package(store, request, core_services=None):
    request = EvidencePackageRequest.model_validate(request.model_dump(mode="json") if hasattr(request, "model_dump") else request)
    request.supplemental_facts = dict(sorted(request.supplemental_facts.items()))
    code = code_version()
    inputs = capture_inputs(store, request)
    response = assist(PackageStore(inputs), request, core_services)
    if code_version() != code:
        raise DatasetUnavailable("Code changed while packaging; restart with a stable code version")
    package = EvidencePackage(request=request, inputs=inputs, response=response, code=code,
                              artifact_label=artifact_label(inputs), input_sha256=digest(inputs.model_dump(mode="json")),
                              response_sha256=digest(response.model_dump(mode="json")), package_sha256="0" * 64,
                              limitations=[
                                  "Reproduction verifies software output, not legal accuracy or complete source coverage.",
                                  "Original facts and submitted answers are separate; answers remain unverified and request-local.",
                                  "All available rules and source snapshots are included for dependency and planning replay; only one property is included.",
                                  "Missing sources, stale evidence, partial extraction and unavailable services remain visible in the response.",
                                  "Replay requires matching application file hashes, Python and recorded dependency versions; executable code is not included.",
                                  "Hashes detect changed content; they are not a signature or independent proof of source authenticity.",
                              ], disclaimer=DISCLAIMER)
    package.package_sha256 = package_digest(package)
    return package


def replay_evidence_package(value):
    package = EvidencePackage.model_validate(value.model_dump(mode="json") if hasattr(value, "model_dump") else value)
    if package_digest(package) != package.package_sha256:
        raise ValueError("Evidence package integrity check failed")
    if digest(package.inputs.model_dump(mode="json")) != package.input_sha256 or digest(package.response.model_dump(mode="json")) != package.response_sha256:
        raise ValueError("Evidence package input/response hash mismatch")
    check_input_ids(package.inputs, package.request)
    if package.artifact_label != artifact_label(package.inputs):
        raise ValueError("Evidence package data label mismatch")
    if code_version() != package.code:
        raise ValueError("Evidence package code/runtime differs; use the recorded application version for exact replay")
    # Preserve an explicitly unavailable capability even if this runtime can supply it.
    actual = core_module()
    functions = {}
    for capability, name in (("question_planner", "plan_questions"), ("rule_renderer", "render_rule")):
        if package.response.capabilities.get(capability) == "implemented":
            fn = getattr(actual, name, None)
            if not callable(fn):
                raise CoreUnavailable(f"Replay requires the recorded {capability}")
            functions[name] = fn
    request = package.request.model_copy(deep=True)
    request.supplemental_facts = dict(sorted(request.supplemental_facts.items()))
    reproduced = assist(PackageStore(package.inputs), request, SimpleNamespace(**functions))
    if reproduced.model_dump(mode="json") != package.response.model_dump(mode="json"):
        raise ValueError("Evidence package response does not reproduce from the recorded inputs")
    return EvidenceReplayResult(package_sha256=package.package_sha256, input_sha256=package.input_sha256,
                                response_sha256=package.response_sha256, disclaimer=DISCLAIMER)


def write_evidence_package(store, request, output):
    output = Path(output).resolve()
    if output.exists() or output.is_relative_to(store.root.resolve()):
        raise ValueError("Choose a new package file outside the input store")
    package = build_evidence_package(store, request)
    output.parent.mkdir(parents=True, exist_ok=True)
    # Publish complete bytes without replacing an output created while assist ran.
    # Same-filesystem link creation is atomic and fails if the destination exists.
    with TemporaryDirectory(prefix=".evidence-package-", dir=output.parent) as staging:
        staged = Path(staging) / "package.json"
        write_json(staged, package)
        os.link(staged, output)
    return {"output": str(output), "package_sha256": package.package_sha256, "artifact_label": package.artifact_label}
