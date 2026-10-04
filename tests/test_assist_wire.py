import json

from navigator.assist_service import assist
from navigator.assist_wire import pack, unpack
from navigator.models import AssistRequest


def test_lossless_literals_and_repeated_containers():
    original = {"unicode": "é𐍈", "literal": {"a": [False, None, 0, 0.0, ""]},
                "twice": [{"o": [["$ref", 5]]}] * 10}
    encoded = json.loads(json.dumps(pack(original)))
    assert unpack(encoded) == original


def test_real_canonical_response_roundtrips(demo):
    original = assist(demo, AssistRequest(address_id="SYNTH-003")).model_dump(mode="json")
    assert unpack(pack(original)) == original
