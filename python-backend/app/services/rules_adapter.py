"""Contract envelope for the offline rules facade; context is server-owned."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from app.domain.api_contract_models import ContractIssue, EvaluateRequest, EvaluateResponse
from app.rules.engine import evaluate_project


@dataclass(frozen=True)
class TrustedRulesContext:
    jurisdiction: str | None = None
    regulatory_inputs: dict[str, Any] = field(default_factory=dict)
    stage: str = 'preparation'
    completed_prerequisites: tuple[str, ...] = ()


class RulesAdapter:
    """Never populate context from applicant answers or infer state from location.

    A deployment may inject an owner-reviewed context resolver and audit sink.
    The default deliberately leaves jurisdiction and statutory inputs unknown.
    Audit metadata excludes the applicant profile and extracted credentials.
    """
    def __init__(self, context_provider: Callable[[str, str], TrustedRulesContext] | None = None,
                 audit_sink: Callable[[str, str, dict], None] | None = None, clock=None):
        self.context_provider = context_provider
        self.audit_sink = audit_sink
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def __call__(self, request: EvaluateRequest) -> EvaluateResponse:
        now = self.clock()
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError('Evaluation time must include a timezone')
        context = self.context_provider(request.project_id, request.rules_version) if self.context_provider else TrustedRulesContext()
        if not isinstance(context, TrustedRulesContext):
            raise ValueError('Context resolver must return TrustedRulesContext')
        result = evaluate_project(request.project.model_dump(by_alias=True), request.rules_version,
                                  jurisdiction=context.jurisdiction, evaluation_date=now.date(),
                                  regulatory_inputs=context.regulatory_inputs, stage=context.stage,
                                  completed_prerequisites=context.completed_prerequisites)
        issues = []
        for item in result['integrationIssues']:
            for path in item['fields'] or [None]:
                issues.append(ContractIssue.model_validate({
                    'code': 'REGULATORY_REVIEW_REQUIRED', 'severity': 'error', 'field': path,
                    'approvalKey': item['approvalKey'], 'documentKey': None, 'documentId': None,
                    'message': f"{item['ruleId'] or 'Workflow'}: {item['message']}",
                    'suggestedAction': item['action'],
                }))
        for reason in result['reviewReasons']:
            issues.append(ContractIssue.model_validate({
                'code': 'REGULATORY_DECISION_UNRESOLVED', 'severity': 'error', 'field': None,
                'approvalKey': None, 'documentKey': None, 'documentId': None,
                'message': reason, 'suggestedAction': 'Obtain authoritative applicability review; document checks do not establish eligibility.',
            }))
        if result['submissionBlocked'] and not issues:
            issues.append(ContractIssue.model_validate({
                'code': 'SUBMISSION_BLOCKED', 'severity': 'error', 'field': None,
                'approvalKey': None, 'documentKey': None, 'documentId': None,
                'message': 'The regulatory engine has blocked submission.',
                'suggestedAction': 'Resolve the regulatory review before submission.',
            }))
        response = EvaluateResponse.model_validate({
            'rulesVersion': request.rules_version, 'projectId': request.project_id,
            'evaluatedAt': now, 'readinessScore': None,
            'blockingIssues': issues, 'approvals': result['approvals'],
        })
        if self.audit_sink:
            self.audit_sink(request.project_id, request.rules_version, result)
        return response
