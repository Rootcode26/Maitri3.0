"""Trusted in-process P1 integration. Never obtain requirements from the browser."""
from app.domain.api_contract_models import EvaluateRequest, EvaluateResponse


class RulesUnavailable(RuntimeError):
    pass


def register_rules_evaluator(app, evaluator):
    """P1 supplies a sync callable (EvaluateRequest) -> EvaluateResponse."""
    app.state.rules_evaluator = evaluator


def evaluate_registered(app, request: EvaluateRequest):
    evaluator = getattr(app.state, "rules_evaluator", None)
    if evaluator is None:
        raise RulesUnavailable("Person 1's evaluator is not configured")
    try:
        result = evaluator(request)
        if not isinstance(result, EvaluateResponse):
            raise RulesUnavailable("Evaluator must return a validated EvaluateResponse")
        if result.rules_version != request.rules_version or result.project_id != request.project_id:
            raise RulesUnavailable("Evaluator returned a different project or rule version")
        return result
    except RulesUnavailable:
        raise
    except Exception:
        raise RulesUnavailable("The trusted evaluator could not complete") from None


def evaluate_for_validation(app, request):
    return evaluate_registered(app, EvaluateRequest.model_validate({
        "rulesVersion": request.rules_version, "projectId": request.project_id,
        "project": request.project.model_dump(by_alias=True),
    }))
