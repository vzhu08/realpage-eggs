"""Independent local retrieval. Scores select passages; they never verify meaning."""
import math
import re
from collections import Counter

from .models import SourceSpan, SourceContext, SourceDependency

HEADINGS = re.compile(r"(?im)^[ \t]*(?:(?:section|sec\.?|§)\s+(\d[\w.()\-]*)|((?:\d+\.){2,}\d+))[^\n]*")
REFERENCES = re.compile(r"(?i)\b(?:see|under|pursuant to|subject to|defined in|as defined in|as provided in|except as provided in|except as stated in)\s+(?:(?P<doc>[A-Z][A-Z0-9_-]*\d[A-Z0-9_-]*)\s+)?(?:section|sec\.?|§)\s+(?P<section>\d[\w.()\-]*)")


def section_key(value):
    return value.strip().rstrip(".").casefold()


def sections(source):
    matches = list(HEADINGS.finditer(source.text))
    if not matches:
        return [(None, 0, len(source.text))] if source.text else []
    result = [(None, 0, matches[0].start())] if matches[0].start() else []
    for i, match in enumerate(matches):
        result.append((section_key(match[1] or match[2]), match.start(), matches[i+1].start() if i+1 < len(matches) else len(source.text)))
    return result


def span(source, start, end, section=None):
    return SourceSpan(doc_id=source.doc_id, source_hash=source.sha256, start=start, end=end, text=source.text[start:end], section=section)


def source_units(source, size=2400):
    """Partition all text; no prefix truncation or dropped tail/headers."""
    units = []
    for section, start, end in sections(source):
        for position in range(start, end, size):
            units.append(span(source, position, min(position + size, end), section))
    return units


class ContextRetriever:
    def __init__(self, sources):
        self.sources = sources
        self.section_index = {k: sections(source) for k, source in sources.items()}

    def search(self, query, limit=6, doc_id=None):
        tokens = lambda text: Counter(re.findall(r"[\w]+", text.casefold()))
        units = [unit for ident, source in sorted(self.sources.items()) if doc_id is None or ident == doc_id for unit in source_units(source)]
        counts = [tokens(unit.text) for unit in units]
        df = Counter(word for count in counts for word in count)
        idf = {word: math.log((1 + len(units)) / (1 + count)) + 1 for word, count in df.items()}
        vector = lambda count: {w: (1 + math.log(n)) * idf.get(w, 1) for w, n in count.items()}
        q = vector(tokens(query))
        norm = lambda v: math.sqrt(sum(n*n for n in v.values()))
        hits = []
        for unit, count in zip(units, counts):
            v = vector(count)
            score = sum(q.get(w, 0) * weight for w, weight in v.items()) / ((norm(q) * norm(v)) or 1)
            if score: hits.append({"score": round(score, 8), "span": unit.model_dump(mode="json")})
        return {"items": sorted(hits, key=lambda h: (-h["score"], h["span"]["doc_id"], h["span"]["start"]))[:limit], "method": "local_tfidf_cosine_independently_implemented", "semantic_verification": False}

    def context(self, anchors, max_depth=2, max_chars=24000, max_spans=12, radius=800):
        result, dependencies, hits, visited = [], [], [], set()
        chars = 0

        def append_span(item):
            nonlocal chars
            if any(s.doc_id == item.doc_id and s.start == item.start and s.end == item.end for s in result): return True
            if len(result) >= max_spans or chars + len(item.text) > max_chars:
                hits.append("max_spans" if len(result) >= max_spans else "max_chars")
                return False
            result.append(item)
            chars += len(item.text)
            return True

        def visit(item, depth, trail):
            identity = (item.doc_id, item.start, item.end)
            if identity in visited: return
            visited.add(identity)
            if not append_span(item): return
            for match in REFERENCES.finditer(item.text):
                target_doc = match.group("doc") or item.doc_id
                target_section = section_key(match.group("section"))
                origin = span(self.sources[item.doc_id], item.start + match.start(), item.start + match.end(), item.section)
                candidates = [(label, a, b) for label, a, b in self.section_index.get(target_doc, []) if label == target_section]
                key = (target_doc, target_section)
                status, explanation, targets = "resolved", "Exact source section heading located; meaning not verified", []
                if key in trail:
                    status, explanation = "cycle", "Cross-reference cycle; no completeness inferred"
                elif not candidates:
                    status, explanation = "missing", "Referenced section not present in available snapshots; not proof the authority does not exist"
                elif len(candidates) > 1:
                    status, explanation = "ambiguous", "More than one matching section heading"
                elif depth >= max_depth:
                    status, explanation = "depth_limit", "Explicit cross-reference depth budget reached"
                    hits.append("max_depth")
                else:
                    label, start, end = candidates[0]
                    target_source = self.sources[target_doc]
                    target = span(target_source, start, end, label)
                    already_present = any(s.doc_id == target.doc_id and s.start == target.start and s.end == target.end for s in result)
                    if not already_present and (len(target.text) > max_chars - chars or len(result) >= max_spans):
                        status, explanation = "budget_limit", "Referenced section exceeds remaining context budget; not silently truncated"
                        hits.append("reference_budget")
                    else:
                        targets = [target]
                        visit(target, depth + 1, trail | {key})
                dependencies.append(SourceDependency(reference=match.group(), origin=origin, status=status, target_doc_id=target_doc, target_section=target_section, spans=targets, explanation=explanation))

        for anchor in anchors:
            source = self.sources.get(anchor.doc_id)
            if not source or not source.text:
                hits.append(f"missing_source:{anchor.doc_id}")
                continue
            if anchor.source_hash != source.sha256 or source.text[anchor.start:anchor.end] != anchor.text:
                hits.append(f"stale_anchor:{anchor.doc_id}")
                continue
            containing = [(label, a, b) for label, a, b in self.section_index[source.doc_id] if a <= anchor.start and anchor.end <= b]
            label, start, end = containing[-1] if containing else (None, 0, len(source.text))
            if any(s.doc_id == source.doc_id and s.start <= start and end <= s.end for s in result): continue
            if end - start > max_chars - chars:
                start, end = max(start, anchor.start-radius), min(end, anchor.end+radius)
                hits.append("section_windowed")
            visit(span(source, start, end, label), 0, {(source.doc_id, label)})
        partial = bool(hits or any(d.status != "resolved" for d in dependencies))
        return SourceContext(spans=result, dependencies=dependencies, status="missing" if not result else "partial" if partial else "available", limits={"max_depth": max_depth, "max_chars": max_chars, "max_spans": max_spans}, limits_hit=sorted(set(hits)))
