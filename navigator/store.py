import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from .models import Model, PropertyFacts, SourceDocument, JurisdictionResolution, Rule, RunManifest
from .config import VERSION


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def digest(value) -> str:
    if not isinstance(value, bytes):
        value = json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def read_json(path: Path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(value, Model):
        value = value.model_dump(mode="json")
    temp = path.with_suffix(f".{uuid4().hex}.tmp")
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False, default=str) + "\n", encoding="utf-8")
    os.replace(temp, path)


class Store:
    """Single CLI writer, atomic JSON snapshots; API only reads snapshots."""
    def __init__(self, root: Path):
        self.root = Path(root)

    def path(self, name: str) -> Path:
        return self.root / name

    def read(self, name, default=None):
        return read_json(self.path(name), default)

    def write(self, name, value):
        write_json(self.path(name), value)

    def collection(self, name, cls):
        return {k: cls.model_validate(v) for k, v in self.read(f"{name}.json", {}).items()}

    def save_collection(self, name, values):
        self.write(f"{name}.json", {k: v.model_dump(mode="json") for k, v in sorted(values.items())})

    def sources(self): return self.collection("sources", SourceDocument)
    def addresses(self): return self.collection("addresses", PropertyFacts)
    def resolutions(self): return self.collection("resolutions", JurisdictionResolution)
    def rules(self): return self.collection("rules", Rule)

    def new_run(self, operation, mode="local", **kwargs):
        run = RunManifest(run_id=uuid4().hex, operation=operation, mode=mode, started_at=now(), versions={"pipeline": VERSION, "evaluator": VERSION}, **kwargs)
        self.save_run(run)
        return run

    def save_run(self, run):
        self.write(f"runs/{run.run_id}.json", run)
        self.write(f"latest_{run.operation}.json", run)

    def finish(self, run, outcome, **counts):
        run.outcome = outcome
        run.finished_at = now()
        run.elapsed_seconds = round((datetime.fromisoformat(run.finished_at) - datetime.fromisoformat(run.started_at)).total_seconds(), 3)
        run.counts.update(counts)
        self.save_run(run)
        return run


def change_cache_key(store, request):
    """Bind cached Core output to every consumed input and the actual evaluator code."""
    from importlib.metadata import version
    import platform
    from .config import ROOT
    inputs = {"request": request.model_dump(mode="json"),
              "rules": {k: v.model_dump(mode="json") for k, v in store.rules().items()},
              "addresses": {k: v.model_dump(mode="json") for k, v in store.addresses().items()},
              "resolutions": {k: v.model_dump(mode="json") for k, v in store.resolutions().items()},
              "change_tests": store.read("change_tests.json", [])}
    # compute_changes consumes prepared rules, property/resolution models and selectors.
    # Hash its whole implementation dependency set; no timestamp-only invalidation.
    names = ["navigator/changes.py", "navigator/engine.py", "navigator/predicates.py",
             "navigator/models.py", "navigator/config.py", "navigator/store.py", "config/test_rule_selectors.json"]
    code = {name: digest((ROOT / name).read_bytes().replace(b"\r\n", b"\n")) for name in names}
    return digest({"format": "change-cache-v1", "inputs": inputs, "code": code,
                   "python": platform.python_version(), "pydantic": version("pydantic"), "pydantic_core": version("pydantic_core")})


def cached_changes(store, request):
    """Read verified offline results or use Core; HTTP never writes a result cache."""
    from .changes import compute_changes
    from .models import ChangeResult
    key = change_cache_key(store, request)
    cached = store.read(f"change_cache/{key}.json")
    if cached and cached.get("key") == key and cached.get("result_sha256") == digest(cached.get("result")):
        try:
            return ChangeResult.model_validate(cached["result"])
        except ValueError:
            pass
    return compute_changes(store, request)


def save_change_cache(output, store, request, result):
    """Persist a just-computed Core result for a separately prepared immutable release."""
    key = change_cache_key(store, request)
    value = result.model_dump(mode="json")
    write_json(output / f"{key}.json", {"key": key, "request": request.model_dump(mode="json"),
                                      "result": value, "result_sha256": digest(value)})
    return key
