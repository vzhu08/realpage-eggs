"""Lossless transport for repeated assist trees. No evidence or result is omitted.

Nodes are topologically ordered: scalars are JSON primitives; containers are
{'a': [node ids]} or {'o': [[key, node id], ...]}. Repeated equal subtrees share
an id. The normal endpoint still offers the full canonical JSON representation.
"""
import json
import re

MEDIA_TYPE = "application/vnd.realpage.assist-dag+json"
FORMAT = "realpage-assist-dag-v1"


def pack_json(text):
    """Intern directly while parsing canonical JSON; never expand its repeated tree.

    Input is the validated model's own JSON serializer output. Scalars use Python's
    JSON decoder; containers keep only node references. This bounds transient
    allocations to the canonical text plus the compact graph and recursion stack.
    """
    nodes, intern = [], {}
    decoder = json.JSONDecoder()
    whitespace = re.compile(r"\s*")
    cursor = 0

    def skip():
        nonlocal cursor
        cursor = whitespace.match(text, cursor).end()

    def visit():
        nonlocal cursor
        skip()
        char = text[cursor]
        if char in "[{":
            cursor += 1
            skip()
            closing, children = ("]" if char == "[" else "}"), []
            while text[cursor] != closing:
                if char == "{":
                    key, cursor = decoder.raw_decode(text, cursor)
                    skip()
                    if not isinstance(key, str) or text[cursor] != ":":
                        raise ValueError("Invalid canonical object")
                    cursor += 1
                    children.append([key, visit()])
                else:
                    children.append(visit())
                skip()
                if text[cursor] == closing:
                    break
                if text[cursor] != ",":
                    raise ValueError("Invalid canonical container")
                cursor += 1
                skip()
            cursor += 1
            node = {"a" if char == "[" else "o": children}
        else:
            node, cursor = decoder.raw_decode(text, cursor)
        key = json.dumps(node, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        if key not in intern:
            intern[key] = len(nodes)
            nodes.append(node)
        return intern[key]

    root = visit()
    skip()
    if cursor != len(text):
        raise ValueError("Trailing canonical JSON")
    return {"format": FORMAT, "nodes": nodes, "root": root}


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
