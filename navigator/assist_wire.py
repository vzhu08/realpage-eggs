"""Lossless transport for repeated assist trees. No evidence or result is omitted.

Nodes are topologically ordered: scalars are JSON primitives; containers are
{'a': [node ids]} or {'o': [[key, node id], ...]}. Repeated equal subtrees share
an id. The normal endpoint still offers the full canonical JSON representation.
"""
import json

MEDIA_TYPE = "application/vnd.realpage.assist-dag+json"
FORMAT = "realpage-assist-dag-v1"


def pack(value):
    nodes, intern = [], {}

    def visit(item):
        if isinstance(item, dict):
            node = {"o": [[key, visit(child)] for key, child in item.items()]}
        elif isinstance(item, list):
            node = {"a": [visit(child) for child in item]}
        else:
            node = item
        key = json.dumps(node, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        if key not in intern:
            intern[key] = len(nodes)
            nodes.append(node)
        return intern[key]

    root = visit(value)
    return {"format": FORMAT, "nodes": nodes, "root": root}


def unpack(value):
    """Reference decoder used by equivalence tests and the offline verifier."""
    if value["format"] != FORMAT:
        raise ValueError("Unknown assist transport")
    nodes = []
    for node in value["nodes"]:
        if isinstance(node, dict):
            if list(node) == ["a"]:
                node = [nodes[i] for i in node["a"]]
            elif list(node) == ["o"]:
                node = {key: nodes[i] for key, i in node["o"]}
            else:
                raise ValueError("Invalid container")
        nodes.append(node)
    return nodes[value["root"]]
