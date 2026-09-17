"""Existing flat Node contract; shares the registered evaluator with validation."""
from fastapi import APIRouter, Depends, HTTPException, Request
from app.api.routes.validation import require_internal_token
from app.domain.api_contract_models import EvaluateRequest, EvaluateResponse
from app.services.rule_provider import RulesUnavailable, evaluate_registered

router = APIRouter()


@router.post('/evaluate', response_model=EvaluateResponse, tags=['evaluation'], dependencies=[Depends(require_internal_token)])
def evaluate(payload: EvaluateRequest, request: Request) -> EvaluateResponse:
    try:
        return evaluate_registered(request.app, payload)
    except RulesUnavailable:
        raise HTTPException(503, detail={'code': 'RULES_UNAVAILABLE', 'message': 'The trusted rules evaluator is unavailable for this version.'}) from None
