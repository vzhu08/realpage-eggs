"""A warmed assist result must not bypass a later source-role correction."""
import json

from navigator.assist_cache import AssistCache, identity
from navigator.models import AssistRequest


def test_source_role_change_invalidates_warm_assist_and_preserves_unknown(demo, tmp_path):
    sources = demo.sources()
    for source in sources.values():
        source.capture_status = "supplied"
        source.source_type = "legal_text"
        source.authority = "official"
    demo.save_collection("sources", sources)
    assert "navigator/source_policy.py" in identity(demo)["code"]
    cache = AssistCache(tmp_path / "derived-cache")
    request = AssistRequest(address_id="SYNTH-001", as_of="2026-11-15")

    def read(artifact):
        return json.loads(b"".join(artifact.chunks(False)))

    initial = cache.resolve(demo, request)
    initial_key = initial.key
    assert read(initial)["lookup"]["evaluations"][0]["result"] == "applies"
    for source in sources.values():
        source.authority = "secondary"
    demo.save_collection("sources", sources)

    corrected = cache.resolve(demo, request)
    assert corrected.key != initial_key and not corrected.hit
    result = read(corrected)
    assert result["lookup"]["evaluations"][0]["result"] == "unknown"
    assert result["lookup"]["metadata"]["source_review_rule_ids"]
    replay = cache.resolve(demo, request)
    assert replay.hit and read(replay) == result
