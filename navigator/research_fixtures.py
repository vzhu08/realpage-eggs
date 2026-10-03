"""Authored contract examples, not a question planner or production fallback."""
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

from .config import DISCLAIMER, ROOT
from .demo import build_demo
from .engine import evaluate_rules
from .fact_inputs import FACT_DEFINITIONS
from .models import (AnalysisLimits, AlternativeOutcome, AssistResponse, EncodedRuleRendering,
                     Expression, FactQuestion, LookupRequest, PredicateTrace, QuestionPlan, Uncertainty)
from .service import lookup
from .store import digest, write_json


def generate_research_fixtures():
    outputs = {}
    with TemporaryDirectory() as temporary:
        store = build_demo(Path(temporary))
        for case in ("decisive_question", "irrelevant_missing_fact", "two_unresolved_exemptions", "unresolved_source_coverage", "bounded_partial_analysis"):
            ident = "SYNTH-002" if case == "irrelevant_missing_fact" else "SYNTH-003"
            rules = store.rules()
            rule = next(iter(rules.values())).model_copy(deep=True)
            field, limits = "units", AnalysisLimits()
            prop = store.addresses()[ident].model_copy(deep=True)
            if case == "two_unresolved_exemptions":
                field = "certificate_of_occupancy"
                prop.facts["units"] = 12
                rule.coverage_conditions = Expression(op="all", args=[Expression(op="gte", fact="units", value=4), Expression(op="date_on_or_before", fact=field, value="2020-06-30")])
                rule.exemption_conditions = Expression(op="any", args=[Expression(op="eq", fact="owner_occupied", value=True), Expression(op="eq", fact="exemption_filed", value=True)])
            resolution = store.resolutions()[ident]
            response = lookup(store, LookupRequest(address_id=ident, as_of=date(2026, 11, 15)))
            response.address = prop
            response.rules = [rule]
            response.evaluations = [e for e in evaluate_rules([rule], prop, resolution, response.as_of) if e.result not in {"inapplicable", "failed"}]
            response.metadata["fixture_case"] = case
            response.warnings.append("CONTRACT FIXTURE: question plans/renderings are authored expectations, not implemented Core output; modified rule cases are algorithmic tests, not legal interpretations")
            questions, remaining = [], []
            if case == "unresolved_source_coverage":
                remaining = [Uncertainty(kind="source_gap", message="Referenced exception source is not supplied", remedy="Platform/Core must obtain and verify the cited exception; do not ask the renter to decide the law", rule_ids=[rule.team_rule_id])]
            elif case != "irrelevant_missing_fact":
                alternatives = []
                probes = ["2020-06-30", "2020-07-01"] if field == "certificate_of_occupancy" else [7, 8]
                for number, probe in enumerate(probes):
                    changed = prop.model_copy(deep=True)
                    changed.facts[field] = probe
                    changed.provenance[field] = "Hypothetical fixture probe; not a property fact"
                    result = evaluate_rules([rule], changed, resolution, response.as_of)
                    uncertainty = [Uncertainty(kind="property_fact", field=f, message=f"Still need {f}", remedy="Ask for the documented factual value", rule_ids=[rule.team_rule_id]) for f in sorted({f for e in result for f in e.missing_facts})]
                    alternatives.append(AlternativeOutcome(alternative_id=f"fixture-alt-{number}", label=f"If {field} is {probe}", probe_facts={field: probe}, evaluations=result, remaining_uncertainty=uncertainty))
                pid = rule.team_rule_id + ":coverage_conditions/args/1" if field != "units" else rule.team_rule_id + ":coverage_conditions/args/1"
                questions = [FactQuestion(question_id=f"q:{field}", fact=FACT_DEFINITIONS[field], prompt=f"What is the property's {field.replace('_', ' ')}?", why="This fact controls an unresolved coverage comparison; other exemptions may still keep the result unknown", rule_ids=[rule.team_rule_id], predicate_ids=[pid], evidence=rule.evidence, alternatives=alternatives, rank_score=1 / FACT_DEFINITIONS[field].answer_effort, ranking_rationale="Fixture expectation: one affected comparison divided by answer-effort weight; not a probability")]
            partial = case in {"two_unresolved_exemptions", "bounded_partial_analysis"}
            if case == "bounded_partial_analysis":
                limits = AnalysisLimits(max_evaluations=1)
                questions[0].alternatives = questions[0].alternatives[:1]
                remaining.append(Uncertainty(kind="analysis_limit", message="Only one alternative evaluated", remedy="Increase the explicit evaluation budget or retain uncertainty"))
            plan = QuestionPlan(status="partial" if partial else "complete", questions=questions, remaining_uncertainty=remaining, limits=limits, evaluations_used=sum(len(q.alternatives) for q in questions), limits_hit=["max_evaluations"] if case == "bounded_partial_analysis" else [], algorithm_version="authored-contract-fixture-v1", exhaustive=False)
            result = AssistResponse(lookup=response, question_plan=plan, evidence_reports=[], encoded_rules=[], answers_applied=[], capabilities={"question_planner": "dependency_unavailable", "rule_renderer": "dependency_unavailable", "evidence": "dependency_unavailable"}, mode="contract_fixture")
            output = {"fixture_mode": "synthetic", "contract_status": "proposed_core_output_not_live_service", "case": case, "request": {"address_id": ident, "as_of": "2026-11-15"}, "response": result.model_dump(mode="json")}
            write_json(ROOT / f"contracts/research_examples/{case}.json", output)
            outputs[case] = output
    return outputs
