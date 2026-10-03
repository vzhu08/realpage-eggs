from datetime import date

from .models import Rule, JurisdictionResolution, PropertyFacts, Evaluation, PredicateResult, date_bounds
from .predicates import evaluate_expression, combine


def temporal(rule: Rule, as_of: date, hypothetical=False) -> str:
    if hypothetical and rule.lifecycle == "pending":
        return "in_force"
    lifecycle = rule.lifecycle
    events = sorted(rule.status_events, key=lambda e: date_bounds(e.on)[0])
    if events:
        lifecycle = "unknown"
        for event in events:
            lo, hi = date_bounds(event.on)
            if lo <= as_of < hi:
                return "unknown"
            if hi <= as_of:
                lifecycle = event.status
        if lifecycle == "unknown":
            # A documented future enactment supports pre-effective, not current force.
            if any(e.status == "enacted" for e in events):
                return "not_yet_effective"
            return "unknown"
    elif rule.status_as_of and as_of < date_bounds(rule.status_as_of)[1]:
        # A snapshot does not establish historical lifecycle before that snapshot.
        return "unknown"
    if lifecycle == "pending": return "pending"
    if lifecycle == "failed": return "failed"
    if lifecycle == "repealed": return "inapplicable"
    if lifecycle != "enacted": return "unknown"
    if rule.effective_date:
        lo, hi = date_bounds(rule.effective_date)
        if as_of < lo: return "not_yet_effective"
        if as_of < hi: return "unknown"
    elif not rule.status_as_of:
        return "unknown"
    if rule.end_date:
        lo, hi = date_bounds(rule.end_date)
        if as_of >= hi: return "inapplicable"
        if as_of >= lo: return "unknown"
    return "in_force"


def jurisdiction_match(rule, resolution):
    rule_state = rule.jurisdiction[-2:]
    if not resolution.state: return "unknown"
    if resolution.state != rule_state: return "false"
    if rule.level == "state": return "true"
    if resolution.match_quality != "resolved" or not resolution.municipality: return "unknown"
    return "true" if f"{resolution.municipality}, {resolution.state}".casefold() == rule.jurisdiction.casefold() else "false"


def evaluate_rule(rule: Rule, prop: PropertyFacts, resolution: JurisdictionResolution, as_of: date, hypothetical=False):
    jurisdiction = jurisdiction_match(rule, resolution)
    inclusion = evaluate_expression(rule.coverage_conditions, prop, as_of)
    exemption = evaluate_expression(rule.exemption_conditions, prop, as_of)
    exemption.value = {"true": "false", "false": "true", "unknown": "unknown"}[exemption.value]
    coverage = combine("all", [inclusion, exemption])
    time = temporal(rule, as_of, hypothetical)
    reasons = []
    if jurisdiction == "false" or coverage.value == "false" or time == "inapplicable":
        result = "inapplicable"
    elif time == "failed":
        result = "failed"
    elif time in {"pending", "not_yet_effective"}:
        result = time
    elif jurisdiction == "unknown" or coverage.value == "unknown" or time == "unknown" or rule.review_issues or rule.semantic_verification == "needs_review":
        result = "unknown"
    else:
        result = "applies"
    if result != "inapplicable":
        if jurisdiction == "unknown": reasons.append("jurisdiction_uncertainty: legal municipality unresolved")
        if coverage.value == "unknown": reasons.extend(coverage.unresolved)
        if time == "unknown": reasons.append("temporal_uncertainty: date precision or lifecycle history insufficient")
        reasons.extend(f"unresolved_extraction: {issue}" for issue in rule.review_issues)
        if rule.semantic_verification == "needs_review": reasons.append("unresolved_extraction: semantic support needs review")
        if rule.conflict_flag: reasons.append(f"conflicting_legal_evidence: {rule.conflict_note or 'Review source disagreement'}")
    phrasing = {"applies": "covers this property", "unknown": "needs more information before coverage can be established", "inapplicable": "does not cover this property on this date", "failed": "is a failed measure and creates no operative obligation", "pending": "is pending and is not current law", "not_yet_effective": "is not yet effective"}
    explanation = f"As of {as_of.isoformat()}, {rule.title} {phrasing[result]}."
    if result == "applies": explanation += f" Requirement: {rule.requirement}"
    facts = []
    for name, supported in sorted(coverage.supporting_facts.items()):
        value = supported.get("value")
        if value is None and supported.get("bound"):
            bound = supported["bound"]
            value = f"between {bound['lower'] if bound['lower'] is not None else 'unbounded'} and {bound['upper'] if bound['upper'] is not None else 'unbounded'}"
        facts.append(f"{name.replace('_', ' ')}: {value}")
    if facts: explanation += " Facts used: " + "; ".join(facts) + "."
    if reasons: explanation += " Review: " + "; ".join(reasons) + "."
    explanation += f" Source: {rule.citation} ({rule.source_doc_id})."
    return Evaluation(team_rule_id=rule.team_rule_id, result=result, jurisdiction=jurisdiction, coverage=coverage, temporal_status=time, missing_facts=coverage.missing_facts if result not in {"inapplicable", "failed"} else [], uncertainty_reasons=reasons, explanation=explanation, conflict_flag=rule.conflict_flag and result not in {"inapplicable", "failed"}, evidence=rule.evidence)


def evaluate_rules(rules: list[Rule], prop: PropertyFacts, resolution: JurisdictionResolution, as_of: date, hypothetical_ids=None):
    hypothetical_ids = set(hypothetical_ids or [])
    rules = sorted(rules, key=lambda r: r.team_rule_id)
    evaluations = {r.team_rule_id: evaluate_rule(r, prop, resolution, as_of, r.team_rule_id in hypothetical_ids) for r in rules}
    # Resolve supported citations to IDs. No precedence inferred from government level.
    edges = []
    for rule in rules:
        for interaction in rule.interactions:
            for target in rules:
                if target.citation.casefold() == interaction.target_citation.casefold() and target.jurisdiction.casefold() == interaction.target_jurisdiction.casefold() and target.category == interaction.category:
                    edges.append((rule.team_rule_id, target.team_rule_id, interaction))
    graph = {}
    for source, target, interaction in edges:
        if interaction.kind == "supersedes": graph.setdefault(source, set()).add(target)

    def reaches(start, target, visited):
        if start == target: return True
        if start in visited: return False
        return any(reaches(n, target, visited | {start}) for n in graph.get(start, set()))

    base = {k: v.result for k, v in evaluations.items()}
    for i, first in enumerate(rules):
        for second in rules[i + 1:]:
            same_provision = (first.jurisdiction, first.category, first.citation.casefold(), first.provision_key.casefold()) == (second.jurisdiction, second.category, second.citation.casefold(), second.provision_key.casefold())
            overlapping = base[first.team_rule_id] == base[second.team_rule_id] == "applies"
            different = (first.requirement, first.key_value) != (second.requirement, second.key_value)
            explicit_priority = second.team_rule_id in graph.get(first.team_rule_id, set()) or first.team_rule_id in graph.get(second.team_rule_id, set())
            if same_provision and overlapping and different and not explicit_priority:
                for rule in (first, second):
                    answer = evaluations[rule.team_rule_id]
                    answer.result = "unknown"
                    answer.conflict_flag = True
                    answer.uncertainty_reasons.append("conflicting_legal_evidence: overlapping versions of one provision without established precedence")
                    answer.explanation += " Conflicting overlapping versions require review."
    for source, target, interaction in edges:
        parent, child = evaluations[source], evaluations[target]
        if base[source] in {"inapplicable", "failed", "pending", "not_yet_effective"} or base[target] in {"inapplicable", "failed"}: continue
        scope = evaluate_expression(interaction.scope, prop, as_of)
        if scope.value == "false": continue
        cycle = interaction.kind == "supersedes" and reaches(target, source, set())
        active = base[source] == "applies" and not parent.conflict_flag and scope.value == "true"
        if interaction.kind == "supersedes" and active and base[target] == "applies" and not cycle:
            child.result = "superseded"
            child.applied_interactions.append(source)
            child.explanation += f" Superseded by {source} within supported scope: {interaction.note}."
        else:
            child.conflict_flag = parent.conflict_flag = True
            note = f"{'cyclic_interaction' if cycle else 'possible_interaction'}: {source} {interaction.kind} {target}: {interaction.note}"
            child.uncertainty_reasons.append(note)
            parent.uncertainty_reasons.append(note)
            child.explanation += " " + note
            parent.explanation += " " + note
    return list(evaluations.values())
