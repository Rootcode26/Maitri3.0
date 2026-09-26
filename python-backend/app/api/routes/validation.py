"""Internal Node-to-Python document validation endpoint."""
import os
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from app.domain.api_contract_models import ValidateRequest, ValidateResponse
from app.services.rule_provider import RulesUnavailable, evaluate_for_validation
from app.services.validation import validate_application
from app.services.document_processing import prepare_validation_documents
from app.services.document_advisories import build_document_advisories
from app.services.attention import calculate_attention_assessment

router = APIRouter()


def require_internal_token(
    token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
):
    expected = os.environ.get("INTERNAL_API_TOKEN")
    if not expected:
        raise HTTPException(503, detail={"code": "INTERNAL_AUTH_NOT_CONFIGURED", "message": "Internal validation access is not configured."})
    if token is None or not secrets.compare_digest(token.encode(), expected.encode()):
        raise HTTPException(401, detail={"code": "UNAUTHORIZED", "message": "Internal caller authentication failed."})


@router.post("/validate", response_model=ValidateResponse, tags=["validation"], dependencies=[Depends(require_internal_token)])
def validate(payload: ValidateRequest, request: Request) -> ValidateResponse:
    try:
        evaluation = evaluate_for_validation(request.app, payload)
        processed = prepare_validation_documents(request.app, payload)
        result = validate_application(processed, evaluation, policy=getattr(request.app.state, 'document_validation_policy', None))
        advisories = build_document_advisories(request.app, payload)
        if advisories:
            result = result.model_copy(update={'warnings': [*result.warnings, *advisories]})
        assessment = calculate_attention_assessment(processed.project, result)
        return ValidateResponse.model_validate({
            **result.model_dump(by_alias=True),
            'attentionAssessment': assessment.model_dump(by_alias=True),
        })
    except RulesUnavailable:
        raise HTTPException(503, detail={
            "code": "RULES_UNAVAILABLE",
            "message": "Validation cannot run until the trusted approval/document evaluator is available for this rule version.",
        }) from None
