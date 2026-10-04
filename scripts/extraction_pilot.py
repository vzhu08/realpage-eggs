"""Manual, single-document pilot using the existing Core extractor; dry-run by default."""
import argparse
from decimal import Decimal
import json
import os
from pathlib import Path
import shutil
import sys

os.environ["PYTHON_DOTENV_DISABLED"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from dotenv import dotenv_values
from navigator.extraction import OpenAIProvider, ProviderFailure, chunks, extract
from navigator.store import Store, digest, now, write_json

MODEL = "gpt-6.1-sol"
MAX_REQUEST_BYTES = 131072
MAX_OUTPUT_TOKENS = 32000
MAX_REQUESTS = 3
RESERVE_PER_REQUEST = Decimal("1.50")


class PilotClient:
    """Abort Core transport retries and reserve allowance before each actual POST."""
    def __init__(self, client, ledger_path, budget):
        self.client, self.timeout = client, client.timeout
        self.path, self.budget = Path(ledger_path), Decimal(str(budget))
        if not self.budget.is_finite() or not 0 < self.budget <= 5:
            raise ValueError("Pilot budget must be finite, positive and at most $5")
        if self.path.exists():
            raise ValueError("Existing budget ledger: inspect billing/results before another pilot")
        self.blocked = False
        self.ledger = {"model": MODEL, "budget_usd": str(self.budget),
                       "reservation_per_request_usd": str(RESERVE_PER_REQUEST),
                       "reservation_is_not_actual_billing": True, "requests": []}
        write_json(self.path, self.ledger)

    def post(self, url, **kwargs):
        count = len(self.ledger["requests"])
        if self.blocked or count >= MAX_REQUESTS or (count + 1) * RESERVE_PER_REQUEST > self.budget:
            raise ProviderFailure("Pilot request/budget limit reached; no request sent")
        payload = dict(kwargs["json"])
        payload["service_tier"] = "default"
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if (url != "https://api.openai.com/v1/responses" or payload.get("model") != MODEL
                or payload.get("max_output_tokens") != MAX_OUTPUT_TOKENS
                or len(raw) > MAX_REQUEST_BYTES):
            raise ProviderFailure("Pilot request exceeds the reviewed model/size policy; no request sent")
        entry = {"number": count + 1, "started_at": now(), "status": "in_flight",
                 "request_sha256": digest(raw), "request_bytes": len(raw)}
        self.ledger["requests"].append(entry)
        self.ledger["reserved_usd"] = str((count + 1) * RESERVE_PER_REQUEST)
        write_json(self.path, self.ledger)
        print(f"Request {count + 1}/{MAX_REQUESTS}; allowance reserved ${self.ledger['reserved_usd']}; waiting for API", flush=True)
        try:
            response = self.client.post(url, **{**kwargs, "json": payload})
            if response.is_error:
                raise ProviderFailure(f"OpenAI HTTP {response.status_code}; pilot stops without retry")
            entry.update(status="response_received", http_status=response.status_code, finished_at=now())
            return response
        except httpx.HTTPError as exc:
            self.blocked = True
            entry.update(status="billing_unknown", error=type(exc).__name__)
            raise ProviderFailure("Transport failed; billing may be unknown. Pilot stopped without retry; inspect dashboard before restarting") from None
        except BaseException:
            self.blocked = True
            entry.update(status="stopped_billing_unreconciled")
            raise
        finally:
            write_json(self.path, self.ledger)

    def close(self):
        self.client.close()


def plan(source_dir, output, doc_id):
    source_dir, output = Path(source_dir).resolve(), Path(output).resolve()
    if source_dir == output or output.is_relative_to(source_dir) or source_dir.is_relative_to(output):
        raise ValueError("Source and new pilot directory must be separate, non-nested paths")
    if output.exists():
        raise ValueError("Pilot directory already exists; inspect its result/billing, do not rerun blindly")
    if not source_dir.is_dir():
        raise ValueError("Source store directory is missing")
    if any(path.is_symlink() for path in source_dir.rglob("*")):
        raise ValueError("Source store contains symlinks; use a verified regular-file snapshot")
    source = Store(source_dir).sources().get(doc_id)
    if not source or not source.text or source.capture_status == "synthetic":
        raise ValueError("Select one captured, non-synthetic source")
    if digest(source.text.encode("utf-8")) != source.sha256:
        raise ValueError("Selected source text/hash mismatch")
    count = sum(1 for _ in chunks(source.text))
    if count != 1:
        raise ValueError("This pilot accepts exactly one chunk (at most 18000 characters)")
    return {"source_dir": str(source_dir), "output": str(output), "doc_id": doc_id,
            "source_sha256": source.sha256, "characters": len(source.text), "chunks": count,
            "model": MODEL, "max_actual_requests": MAX_REQUESTS,
            "max_output_tokens_per_request": MAX_OUTPUT_TOKENS,
            "max_request_json_bytes": MAX_REQUEST_BYTES,
            "max_local_reservation_usd": str(MAX_REQUESTS * RESERVE_PER_REQUEST),
            "provider_calls_started": 0}


def configure_credentials(env_file):
    if env_file:
        if not env_file.is_file():
            raise ValueError("Requested .env file is missing")
        values = dotenv_values(env_file)
        if not values.get("OPENAI_API_KEY"):
            raise ValueError("Selected .env has no OPENAI_API_KEY; refusing fallback to another project")
        # Explicit project selection must override an inherited, possibly unbudgeted key.
        os.environ["OPENAI_API_KEY"] = values["OPENAI_API_KEY"]
    if not os.getenv("OPENAI_API_KEY"):
        raise ValueError("Set OPENAI_API_KEY in the environment or explicitly selected ignored .env")
    os.environ["OPENAI_MODEL"] = MODEL


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source-dir", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--doc-id", default="D069")
    p.add_argument("--budget-usd", type=Decimal, default=Decimal("5"))
    p.add_argument("--env-file", type=Path)
    p.add_argument("--execute", action="store_true")
    args = p.parse_args(argv)
    if not args.budget_usd.is_finite() or not 0 < args.budget_usd <= 5:
        p.error("--budget-usd must be finite, positive and at most 5")
    details = plan(args.source_dir, args.output, args.doc_id)
    details["budget_usd"] = str(args.budget_usd)
    print(json.dumps(details, indent=2), flush=True)
    if not args.execute:
        print("DRY RUN: no provider calls or files written. Add --execute only after configuring the dedicated API project limit.")
        return 0
    configure_credentials(args.env_file)
    # A new complete working copy preserves prior rules/caches while isolating this pilot.
    shutil.copytree(args.source_dir, args.output, ignore=shutil.ignore_patterns(".env", ".env.*"))
    store = Store(args.output)
    store.write("pilot_plan.json", details)
    client = PilotClient(httpx.Client(timeout=httpx.Timeout(120, read=600)),
                         store.path("pilot_budget.json"), args.budget_usd)
    provider = OpenAIProvider(client=client)
    provider.max_output_tokens = MAX_OUTPUT_TOKENS
    result = extract(store, [args.doc_id], provider=provider, limit=1)
    result.config.update(transport_attempts=1, pilot_max_requests=MAX_REQUESTS,
                         pilot_budget_usd=str(args.budget_usd), pilot_ledger="pilot_budget.json")
    store.save_run(result)
    print(result.model_dump_json(indent=2), flush=True)
    print("Inspect latest_extract.json, pilot_budget.json and provider_outputs usage; reconcile actual API billing before any further run.", flush=True)
    return 0 if result.outcome == "success" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
