"""Bounded disk cache of actual, validated canonical AssistResponse artifacts.

Only derived files are written. Hash inputs on each request, including unchanged
source bytes and semantic reviews, instead of trusting file timestamps. Hits hash
and stream one serialized file in chunks; no result graph is loaded into RAM.
"""
from contextlib import contextmanager
from hashlib import sha256
from importlib.metadata import version
import gzip
import json
import os
from pathlib import Path
import platform
import re
import shutil
import tempfile
import threading
import time

from . import assist_service
from .assist_wire import pack
from .config import ROOT
from .models import AssistRequest
from .store import digest, write_json

FORMAT = "assist-cache-v1"
# Every Store input consumed by lookup, evidence preparation and assist. Include
# absent inputs explicitly; new semantic reviews and newly available sources invalidate.
INPUTS = ("dataset.json", "addresses.json", "resolutions.json", "rules.json",
          "sources.json", "extraction_index.json")
CHUNK = 64 * 1024


def file_hash(path):
    with path.open("rb") as stream:
        return sha256_file(stream)


def sha256_file(stream):
    result = sha256()
    while chunk := stream.read(CHUNK):
        result.update(chunk)
    return result.hexdigest()


def identity(store):
    names = [*INPUTS, *(p.relative_to(store.root).as_posix()
                        for p in sorted((store.root / "semantic_reviews").glob("*.json")))]
    snapshot = {name: file_hash(store.path(name)) if store.path(name).is_file() else None for name in names}
    # Hash the complete runtime package/config so new transitive imports cannot be
    # silently missed. Normalize only code line endings for portable release builds.
    code = {p.relative_to(ROOT).as_posix(): digest(p.read_bytes().replace(b"\r\n", b"\n"))
            for folder, pattern in (("navigator", "*.py"), ("config", "*.json"))
            for p in sorted((ROOT / folder).rglob(pattern))}
    runtime = {name: version(name) for name in ("pydantic", "pydantic_core", "fastapi", "starlette")}
    runtime.update(python=platform.python_version(), implementation=platform.python_implementation())
    return {"format": FORMAT, "snapshot": snapshot, "code": code, "runtime": runtime}


def request_key(stamp, request):
    # Do not sort answer lists or remove null/false/default values: ordering and
    # provenance/note are echoed in the canonical response.
    return digest({"identity": stamp, "request": request.model_dump(mode="json")})


class CacheBusy(RuntimeError):
    pass


class Artifact:
    def __init__(self, stream, size, decoded_size, key, hit, representation):
        self.stream, self.size, self.decoded_size = stream, size, decoded_size
        self.key, self.hit, self.representation = key, hit, representation

    def chunks(self, compressed=True):
        try:
            source = self.stream if compressed else gzip.GzipFile(fileobj=self.stream, mode="rb")
            while chunk := source.read(CHUNK):
                yield chunk
        finally:
            self.stream.close()


class AssistCache:
    def __init__(self, root, *, max_entries=16, max_bytes=256 * 1024 * 1024,
                 max_result_bytes=256 * 1024 * 1024):
        self.root = Path(root)
        self.max_entries, self.max_bytes, self.max_result_bytes = max_entries, max_bytes, max_result_bytes
        if min(max_entries, max_bytes, max_result_bytes) <= 0:
            raise ValueError("Cache bounds must be positive")
        self.compute = threading.BoundedSemaphore(1)
        self.lock = threading.RLock()

    def remove(self, path):
        # Derived digest directories only; never follow a link into a source store.
        if path.is_symlink() or path.resolve().parent != self.root.resolve() or not re.fullmatch(r"[0-9a-f]{64}", path.name):
            raise OSError("Refusing to prune a path outside the cache")
        shutil.rmtree(path)

    @contextmanager
    def writer(self):
        self.root.mkdir(parents=True, exist_ok=True)
        lock = self.root / ".writer"
        # Offline prime and API must normally use separate dirs/processes. This
        # cross-process guard also prevents simultaneous writers exceeding bounds.
        lock.mkdir()
        try:
            yield
        finally:
            lock.rmdir()

    def get(self, key, representation="canonical", *, hit=True):
        folder = self.root / key
        try:
            meta_path = folder / "entry.json"
            if meta_path.stat().st_size > 4096:
                return None
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if meta["format"] != FORMAT or meta["key"] != key:
                return None
            item = meta[representation]
            if not 0 < item["bytes"] <= self.max_bytes or not 0 < item["decoded_bytes"] <= self.max_result_bytes:
                return None
            stream = (folder / f"{representation}.json.gz").open("rb")
            try:
                if os.fstat(stream.fileno()).st_size != item["bytes"] or sha256_file(stream) != item["sha256"]:
                    stream.close()
                    return None
                stream.seek(0)
                return Artifact(stream, item["bytes"], item["decoded_bytes"], key, hit, representation)
            except BaseException:
                stream.close()
                raise
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def save(self, key, result):
        # assist returns the canonical validated response; never accept an arbitrary
        # caller-supplied serialized cache body. This is an internal write boundary.
        canonical = result.model_dump_json().encode("utf-8")
        if len(canonical) > self.max_result_bytes:
            return False
        with self.lock, self.writer():
            with tempfile.TemporaryDirectory(prefix=".building-", dir=self.root) as temporary:
                folder = Path(temporary)
                meta = {"format": FORMAT, "key": key, "created": time.time()}
                for name, raw in (("canonical", canonical), ("dag", None)):
                    if name == "dag":
                        raw = json.dumps(pack(json.loads(canonical)), ensure_ascii=False,
                                         separators=(",", ":"), allow_nan=False).encode("utf-8")
                    if len(raw) > self.max_result_bytes:
                        return False
                    path = folder / f"{name}.json.gz"
                    with path.open("wb") as target:
                        with gzip.GzipFile(fileobj=target, mode="wb", compresslevel=6, mtime=0) as compressed:
                            compressed.write(raw)
                    meta[name] = {"bytes": path.stat().st_size, "decoded_bytes": len(raw), "sha256": file_hash(path)}
                write_json(folder / "entry.json", meta)
                needed = sum(p.stat().st_size for p in folder.iterdir())
                if needed > self.max_bytes:
                    return False
                target = self.root / key
                if target.exists():
                    self.remove(target)
                existing = sorted((p for p in self.root.iterdir() if p.is_dir() and re.fullmatch(r"[0-9a-f]{64}", p.name)),
                                  key=lambda p: p.stat().st_mtime)
                sizes = {p: sum(f.stat().st_size for f in p.iterdir() if f.is_file()) for p in existing}
                while existing and (len(existing) >= self.max_entries or sum(sizes.values()) + needed > self.max_bytes):
                    victim = existing.pop(0)
                    self.remove(victim)
                    sizes.pop(victim)
                folder.rename(target)
        return True

    def resolve(self, store, request, representation="canonical", *, core_services=None, force=False):
        # Revalidate even callers using model_construct; hit and miss have the same
        # domain validation, including the real-data restriction on demo provenance.
        request = AssistRequest.model_validate(request.model_dump(mode="json"))
        assist_service.validate_request(store, request)
        stamp = identity(store)
        key = request_key(stamp, request)
        # Injected Core services have no portable identity; never cache their output.
        if core_services is None and not force:
            cached = self.get(key, representation)
            if cached:
                return cached
        # One expensive graph at a time; no unbounded waiting queue. Duplicate
        # requests can retry after the first has completed; browser joins its own.
        if not self.compute.acquire(blocking=False):
            raise CacheBusy("Another uncached analysis is running; retry after it completes")
        try:
            if core_services is None and not force:
                cached = self.get(key, representation)
                if cached:
                    return cached
            result = assist_service.assist(store, request, core_services)
            if core_services is None and identity(store) == stamp:
                try:
                    if self.save(key, result):
                        cached = self.get(key, representation, hit=False)
                        if cached:
                            return cached
                except OSError:
                    pass  # disk full/read-only/corrupt derived files never replace the actual result
            return result
        finally:
            self.compute.release()
