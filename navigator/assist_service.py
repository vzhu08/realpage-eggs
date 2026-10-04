"""Platform orchestration. Question planning and rendering belong to Core."""
import importlib

from pydantic import ValidationError

from .engine import evaluate_rules
from .evidence import EvidenceStoreView, prepare_rules
from .fact_inputs import FACT_DEFINITIONS, validate_facts
from .models import AssistContext, AssistResponse, EncodedRuleRendering, LookupRequest, QuestionPlan, SupplementalAnswer, Uncertainty
from .service import lookup


class CoreUnavailable(RuntimeError): pass
class CoreContractError(RuntimeError): pass


def core_module():
    try: return importlib.import_module("navigator.core_assist")
    except ModuleNotFoundError as exc:
        if exc.name == "navigator.core_assist": return None
        raise CoreUnavailable("Core module dependency could not be loaded") from exc
    except Exception as exc:
        raise CoreUnavailable("Core module could not be loaded") from exc


def core_call(fn, model, *args):
    try:
        result = fn(*args)
    except Exception as exc:
        raise CoreUnavailable("Core service failed; no substitute analysis generated") from exc
    try:
        # Serialize models too, so model_construct cannot bypass boundary validation.
        return model.model_validate(result.model_dump(mode="json") if hasattr(result, "model_dump") else result)
    except (ValidationError, TypeError, ValueError) as exc:
        raise CoreContractError("Core output did not satisfy the shared contract") from exc


def validate_request(store, request):
    mode = "synthetic" if store.read("dataset.json", {}).get("mode") == "synthetic" else "dataset"
    answers = [SupplementalAnswer(field=k, value=v) for k,v in request.supplemental_facts.items()] + request.answers
    if mode != "synthetic" and any(a.provenance == "demo" for a in answers):
        raise ValueError("Demo answers require the separate synthetic dataset")
    facts = validate_facts({a.field: a.value for a in answers})
    return mode, answers, facts


def assist(store, request, core_services=None):
    mode, answers, facts = validate_request(store, request)
    prepared, reports = prepare_rules(store)
    view = EvidenceStoreView(store, prepared)
    actual = lookup(view, LookupRequest(address_id=request.address_id, address=request.address, as_of=request.as_of, supplemental_facts=facts), {a.field: a.provenance for a in answers})
    # Only same-state candidates reach Core; full evaluations include false branches.
    candidates = [r for r in prepared.values() if r.jurisdiction.split(",")[-1].strip() == actual.address.raw_address.state or r.jurisdiction == actual.address.raw_address.state]
    evidence = [reports[r.team_rule_id] for r in candidates]
    context = AssistContext(property=actual.address, jurisdiction=actual.jurisdiction, as_of=request.as_of, rules=candidates, evaluations=evaluate_rules(candidates, actual.address, actual.jurisdiction, request.as_of), evidence_reports=evidence, fact_definitions=FACT_DEFINITIONS, limits=request.limits)
    core = core_services if core_services is not None else core_module()
    planner, renderer = getattr(core, "plan_questions", None), getattr(core, "render_rule", None)
    capabilities = {"lookup": "implemented", "evidence": "implemented", "question_planner": "implemented" if callable(planner) else "dependency_unavailable", "rule_renderer": "implemented" if callable(renderer) else "dependency_unavailable"}
    if callable(planner):
        plan = core_call(planner, QuestionPlan, context.model_copy(deep=True))
        if plan.limits != request.limits or plan.evaluations_used > request.limits.max_evaluations or len(plan.questions) > request.limits.max_questions:
            raise CoreContractError("Core planner output exceeds or changes requested limits")
        if plan.limits_hit and (plan.status != "partial" or plan.exhaustive):
            raise CoreContractError("Bounded analysis must remain explicitly partial")
    else:
        plan = QuestionPlan(status="unavailable", questions=[], remaining_uncertainty=[Uncertainty(kind="service_dependency", message="Core question planner has not been integrated", remedy="Complete CORE-03/04 and supply navigator.core_assist.plan_questions")], limits=request.limits, algorithm_version="unavailable")
    rendered = [core_call(renderer, EncodedRuleRendering, r.model_copy(deep=True)) for r in candidates] if callable(renderer) else []
    if any(item.rule_id != rule.team_rule_id for item, rule in zip(rendered, candidates)):
        raise CoreContractError("Renderer returned an unrelated rule identifier")
    return AssistResponse(lookup=actual, question_plan=plan, evidence_reports=evidence, encoded_rules=rendered, answers_applied=answers, scenario_id=request.scenario_id, capabilities=capabilities, mode=mode)
