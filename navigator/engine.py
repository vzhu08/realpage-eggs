from datetime import date

from .models import Rule, JurisdictionResolution, PropertyFacts, Evaluation, PredicateResult, date_bounds
from .predicates import evaluate_expression, evaluate_with_trace, mark_irrelevant, combine


def temporal(rule: Rule, as_of: date, hypothetical=False) -> str:
    if hypothetical and rule.lifecycle == "pending":
        return "in_force"
    lifecycle = rule.lifecycle
    history = [(event.status, *date_bounds(event.on)) for event in rule.status_events]
    events = list(history)
    if events:
        # A dated source snapshot is also lifecycle evidence. Older events must
        # not silently discard it; neither can it establish earlier history.
        if rule.status_as_of:
            events.append((rule.lifecycle, *date_bounds(rule.status_as_of)))
        occurred = [(status, lo, hi) for status, lo, hi in events if hi <= as_of]
        possible = [(status, lo, hi) for status, lo, hi in events if lo <= as_of]
        if not possible:
            return "not_yet_effective" if any(e.status == "enacted" for e in rule.status_events) else "unknown"
        if not occurred:
            return "unknown"  # The first partial-date event may still be in the future.
        # An event can be latest unless another definitely occurred strictly after
        # its latest possible date. Overlapping/same-day conflicting events have
        # no established order; input list order is not lifecycle evidence.
        statuses = {status for status, lo, hi in possible
                    if not any(other_lo > min(hi, as_of) for _, other_lo, _ in occurred)}
        if len(statuses) != 1:
            return "unknown"
        lifecycle = statuses.pop()
        if rule.status_as_of and as_of < date_bounds(rule.status_as_of)[1] and lifecycle != rule.lifecycle:
            # A later snapshot does not date an unrecorded transition. Preserve
            # earlier history only when events explain that snapshot, or the
            # query itself is an exact, uncontradicted status observation.
            snapshot_lo, snapshot_hi = date_bounds(rule.status_as_of)
            prior = [(status, lo, hi) for status, lo, hi in history if hi <= snapshot_lo]
            at_snapshot = {status for status, lo, hi in history if lo <= snapshot_lo
                           and not any(other_lo > min(hi, snapshot_lo) for _, other_lo, _ in prior)} if prior else set()
            explained = at_snapshot == {rule.lifecycle} and not any(
                status != rule.lifecycle and lo <= snapshot_hi and hi >= snapshot_lo
                for status, lo, hi in history)
            observed_now = any(status == lifecycle and lo == hi == as_of for status, lo, hi in history)
            if not explained and not observed_now:
                return "unknown"
    elif rule.status_as_of and as_of < date_bounds(rule.status_as_of)[1]:
        return "unknown"
    elif not rule.status_as_of and lifecycle in {"pending", "failed", "unknown"}:
        return "unknown"  # An undated snapshot cannot establish arbitrary history.
    if lifecycle == "pending": return "pending"
    if lifecycle == "failed": return "failed"
    if lifecycle == "repealed": return "inapplicable"
    if lifecycle != "enacted": return "unknown"
    if rule.effective_date:
        lo, hi = date_bounds(rule.effective_date)
        if as_of < lo: return "not_yet_effective"
        if as_of < hi: return "unknown"
    else:
        # Enactment and an operative date are distinct facts. status_as_of
        # establishes lifecycle, not when an enacted requirement took effect.
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


def evaluate_coverage(rule: Rule, prop: PropertyFacts, as_of: date):
    inclusion, included = evaluate_with_trace(rule.coverage_conditions, prop, as_of,
                                              rule.team_rule_id, "coverage_conditions", rule.evidence)
    exemption, exempted = evaluate_with_trace(rule.exemption_conditions, prop, as_of,
                                              rule.team_rule_id, "exemption_conditions", rule.evidence)
    nonexempt = exemption.model_copy(deep=True)
    nonexempt.value = {"true": "false", "false": "true", "unknown": "unknown"}[exemption.value]
    coverage = combine("all", [inclusion, nonexempt])
    if inclusion.value == "false":
        mark_irrelevant(exempted)
    if exemption.value == "true":
        mark_irrelevant(included)
    return coverage, [included, exempted]


def rule_traces(rule: Rule, prop: PropertyFacts, resolution: JurisdictionResolution, as_of: date):
    """AST paths retain their own truth; exemption negation is applied by coverage."""
    coverage, traces = evaluate_coverage(rule, prop, as_of)
    for i, interaction in enumerate(rule.interactions):
        _, trace = evaluate_with_trace(interaction.scope, prop, as_of, rule.team_rule_id,
                                      f"interactions/{i}/scope", interaction.evidence)
        traces.append(trace)
    if (coverage.value == "false" or jurisdiction_match(rule, resolution) == "false"
            or temporal(rule, as_of) in {"inapplicable", "failed", "pending", "not_yet_effective"}):
        for trace in traces:
            mark_irrelevant(trace)
    return traces


def evaluate_rule(rule: Rule, prop: PropertyFacts, resolution: JurisdictionResolution, as_of: date, hypothetical=False):
    jurisdiction = jurisdiction_match(rule, resolution)
    coverage, _ = evaluate_coverage(rule, prop, as_of)
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
    # Resolve only potentially operative, non-self edges. False scopes and
    # inactive rules cannot establish priority or create interaction cycles.
    inactive = {"inapplicable", "failed", "pending", "not_yet_effective"}
    base = {k: v.result for k, v in evaluations.items()}
    edges = []
    for rule in rules:
        if base[rule.team_rule_id] in inactive: continue
        for interaction in rule.interactions:
            scope = evaluate_expression(interaction.scope, prop, as_of)
            if scope.value == "false": continue
            for target in rules:
                if target.team_rule_id == rule.team_rule_id or base[target.team_rule_id] in inactive: continue
                if target.citation.casefold() == interaction.target_citation.casefold() and target.jurisdiction.casefold() == interaction.target_jurisdiction.casefold() and target.category == interaction.category:
                    edges.append((rule.team_rule_id, target.team_rule_id, interaction, scope))
    graph = {}
    for source, target, interaction, scope in edges:
        if interaction.kind == "supersedes": graph.setdefault(source, set()).add(target)

    def reaches(start, target, visited):
        if start == target: return True
        if start in visited: return False
        return any(reaches(n, target, visited | {start}) for n in graph.get(start, set()))

    definite_priority = {(source, target) for source, target, interaction, scope in edges
                         if interaction.kind == "supersedes" and scope.value == "true"
                         and base[source] == base[target] == "applies"
                         and not evaluations[source].conflict_flag
                         and not reaches(target, source, set())}
    for i, first in enumerate(rules):
        for second in rules[i + 1:]:
            same_provision = (first.jurisdiction, first.category, first.citation.casefold(), first.provision_key.casefold()) == (second.jurisdiction, second.category, second.citation.casefold(), second.provision_key.casefold())
            overlapping = base[first.team_rule_id] == base[second.team_rule_id] == "applies"
            different = (first.requirement, first.key_value) != (second.requirement, second.key_value)
            explicit_priority = (first.team_rule_id, second.team_rule_id) in definite_priority or (second.team_rule_id, first.team_rule_id) in definite_priority
            if same_provision and overlapping and different and not explicit_priority:
                for rule in (first, second):
                    answer = evaluations[rule.team_rule_id]
                    answer.result = "unknown"
                    answer.conflict_flag = True
                    answer.uncertainty_reasons.append("conflicting_legal_evidence: overlapping versions of one provision without established precedence")
                    answer.explanation += " Conflicting overlapping versions require review."
    supersessions = []
    for source, target, interaction, scope in edges:
        parent, child = evaluations[source], evaluations[target]
        cycle = interaction.kind == "supersedes" and reaches(target, source, set())
        if interaction.kind == "supersedes" and scope.value == "true" and (source, target) in definite_priority:
            supersessions.append((source, target, interaction))
        else:
            child.conflict_flag = parent.conflict_flag = True
            note = f"{'cyclic_interaction' if cycle else 'possible_interaction'}: {source} {interaction.kind} {target}: {interaction.note}"
            child.uncertainty_reasons.append(note)
            parent.uncertainty_reasons.append(note)
            child.explanation += " " + note
            parent.explanation += " " + note
    # Resolve conflicts first so interaction order cannot turn a disputed priority
    # into a definite supersession and drop an obligation.
    for source, target, interaction in supersessions:
        parent, child = evaluations[source], evaluations[target]
        if parent.conflict_flag or child.conflict_flag:
            continue
        child.result = "superseded"
        child.applied_interactions.append(source)
        child.explanation += f" Superseded by {source} within supported scope: {interaction.note}."
    return list(evaluations.values())
