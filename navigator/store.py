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
