from collections import defaultdict
from typing import Any
from datetime import date

from app.rules.schemas import Rule
from app.rules.evaluator import RuleAssessment


def build_recommendations(
    matched_rules: list[Rule],
) -> list[dict[str, Any]]:
    """
    Build approval recommendations from matched rules.

    Multiple rules recommending the same approval are combined into
    a single recommendation.
    """

    grouped: dict[str, list[Rule]] = defaultdict(list)

    for rule in sorted(matched_rules, key=lambda item: (item.id, item.version)):
        if rule.then.scope != 'approval':
            continue
        grouped[rule.then.recommend].append(rule)

    recommendations: list[dict[str, Any]] = []

    for approval_code, rules in sorted(grouped.items()):
        matched_rule_ids = [rule.id for rule in rules]

        explanations = [
            rule.explanation
            for rule in rules
            if rule.explanation
        ]

        required_documents: list[Any] = []

        for rule in rules:
            for document in rule.requiredDocuments:
                if document not in required_documents:
                    required_documents.append(document)

        recommendations.append(
            {
                "approvalCode": approval_code,
                "matchedRuleIds": matched_rule_ids,
                "explanation": " ".join(explanations),
                "requiredDocuments": required_documents,
            }
        )

    return recommendations


CATALOG = {
    'food-licence': ('Food-related licence', 'fssai', 30),
    'factory-registration': ('Factory registration', 'dish', 45),
    'fire-noc': ('Fire safety NOC', 'fire-emergency-services', 21),
    'consent-to-operate': ('Consent to operate', 'mpcb', 60),
    'boiler-registration': ('Boiler registration', 'steam-boilers', 30),
}


def enrich_recommendations(assessments: list[RuleAssessment], application: dict[str, Any], *, evaluation_date: date | None = None) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Contract approval objects plus separate owner-integration issues/evidence.

    Singular ruleId: verified definite matches first, then lexical ID/version.
    Missing applicability never becomes 'not required'. No readiness calculation.
    """
    from app.rules.evaluator import assess_conditions
    from app.rules.schemas import DocumentRequirement
    grouped: dict[str, list[RuleAssessment]] = defaultdict(list)
    for assessment in assessments:
        if assessment.rule.then.scope == 'approval' and assessment.state != 'not_matched':
            grouped[assessment.rule.then.recommend].append(assessment)
    approvals, issues, evidence = [], [], []
    for code, candidates in sorted(grouped.items()):
        if code not in CATALOG:
            raise ValueError(f'Unknown approval code: {code}')
        candidates.sort(key=lambda item: (item.state != 'matched', item.rule.id, item.rule.version))
        title, department, days = CATALOG[code]
        documents: dict[str, dict] = {}
        for candidate in candidates:
            rule = candidate.rule
            if candidate.state != 'matched':
                issues.append({'approvalKey': code, 'ruleId': rule.id, 'fields': list(candidate.missing_fields), 'message': rule.explanation, 'action': 'Obtain current departmental applicability/checklist confirmation and missing decision inputs.', 'state': candidate.state})
            document_evidence = []
            for document in rule.requiredDocuments:
                if not isinstance(document, DocumentRequirement):
                    document_evidence.append({'key': document, 'verification': 'PROTOTYPE_ASSUMPTION', 'included': False})
                    issues.append({'approvalKey': code, 'ruleId': rule.id, 'fields': [], 'message': f'Document {document} is an unstructured prototype placeholder.', 'action': 'Confirm and structure the departmental requirement.', 'state': 'needs_review'})
                    continue
                assessment = assess_conditions(document.when, application) if document.when else None
                condition = assessment.value if assessment else True
                missing_fields = list(assessment.missing_fields) if assessment else []
                if document.effectiveFrom and condition is not False:
                    if evaluation_date is None:
                        condition = None
                        missing_fields.append('context.evaluationDate')
                    elif evaluation_date < document.effectiveFrom:
                        condition = False
                document_evidence.append({**document.model_dump(mode='json'), 'conditionResult': condition})
                if condition is None:
                    issues.append({'approvalKey': code, 'ruleId': rule.id, 'fields': sorted(set(missing_fields)), 'message': f'Applicability of document {document.key} is unknown.', 'action': 'Confirm document condition before requesting upload.', 'state': 'insufficient_information'})
                if condition is not True:
                    continue
                if document.verification != 'VERIFIED':
                    issues.append({'approvalKey': code, 'ruleId': rule.id, 'fields': [], 'message': f'Document {document.key} is a preparation suggestion, not a verified requirement.', 'action': 'Confirm the current departmental checklist before final submission.', 'state': 'needs_review'})
                payload = document.model_dump(include={'key', 'name', 'description', 'formats', 'maxSizeMb', 'filesRequired', 'required', 'mustInclude', 'quality', 'fieldsToCompare'}, mode='json')
                # Application-policy semantics: "required" means the applicant must
                # submit this to complete the application, taken from the document's
                # declared flag once its rule applies. Legal verification is separate.
                payload['required'] = bool(document.required) and candidate.state in ('matched', 'needs_review')
                if document.key in documents:
                    previous = documents[document.key]
                    if {key: value for key, value in previous.items() if key != 'required'} != {key: value for key, value in payload.items() if key != 'required'}:
                        raise ValueError(f'Conflicting document metadata for {code}/{document.key}')
                    payload['required'] = previous['required'] or payload['required']
                documents[document.key] = payload
            evidence.append({'approvalKey': code, 'ruleId': rule.id, 'state': candidate.state, 'verification': rule.verification, 'sources': [source.model_dump(mode='json') for source in rule.sources], 'documents': document_evidence, 'processingDaysBasis': 'PROTOTYPE_ASSUMPTION: estimates copied from api-contract.md, not statutory SLAs.'})
        approvals.append({'key': code, 'title': title, 'status': 'required' if any(item.state in ('matched', 'needs_review') and item.rule.then.status == 'required' for item in candidates) else 'recommended', 'reason': ' '.join(dict.fromkeys(item.rule.explanation for item in candidates)), 'ruleId': candidates[0].rule.id, 'departmentKey': department, 'processingDays': days, 'documents': [documents[key] for key in sorted(documents)]})
    return approvals, issues, evidence
