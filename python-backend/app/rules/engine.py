"""Person 1 facade; deliberately not a FastAPI route or response envelope."""
from datetime import date
from typing import Any
from app.rules.evaluator import assess_rules
from app.rules.loader import load_version
from app.rules.normalizer import normalize_project
from app.services.dependency import DependencyEdge, calculate_dependencies
from app.services.recommendation import enrich_recommendations


def evaluate_project(project: dict[str, Any], rules_version: str, *, jurisdiction: str | None = None, evaluation_date: date | None = None, regulatory_inputs: dict[str, Any] | None = None, stage: str = 'preparation', completed_prerequisites: tuple[str, ...] = (), dependency_edges: tuple[DependencyEdge, ...] = (), parallel_groups: tuple[tuple[str, ...], ...] = ()) -> dict[str, Any]:
    """Jurisdiction/confirmed inputs must come from trusted owner context, never inference.

    Missing regulatory inputs remain unknown. Supplying them does not promote an
    unverified screening rule into a statutory determination.
    """
    if jurisdiction is not None and jurisdiction != 'MH':
        raise ValueError('This version supports explicit Maharashtra context only')
    application = normalize_project(project)
    application['location']['stateCode'] = jurisdiction
    application['regulatory'] = dict(regulatory_inputs or {})
    assessments = assess_rules(load_version(rules_version), application, evaluation_date=evaluation_date)
    approvals, issues, evidence = enrich_recommendations(assessments, application, evaluation_date=evaluation_date)
    selected = {item['key'] for item in approvals}
    declared_edges = [DependencyEdge(item.rule.then.recommend, requirement) for item in assessments if item.rule.then.recommend in selected for requirement in item.rule.dependencies]
    dependencies = calculate_dependencies(selected, [*declared_edges, *dependency_edges], stage=stage, completed=completed_prerequisites, parallel_groups=parallel_groups)
    review_reasons = [f'{item.rule.id}: screening-only applicability; non-match is not a verified exemption.' for item in assessments if item.rule.then.scope == 'approval' and item.rule.verification != 'VERIFIED']
    for code in dependencies['dependent'] + dependencies['needsReview']:
        issues.append({'approvalKey': code, 'ruleId': None, 'fields': [], 'message': f'Unresolved prerequisite for stage {stage}.', 'action': 'Resolve prerequisite completion or departmental workflow review.', 'state': 'needs_review'})
    # Unfinished rule/checklist research is an officer note, not an applicant error.
    # Only confirmed unmet workflow prerequisites block at this layer.
    submission_blocked = bool(dependencies['dependent'])
    return {'approvals': approvals, 'integrationIssues': issues, 'evidence': evidence, 'dependencies': dependencies, 'submissionBlocked': submission_blocked, 'reviewReasons': review_reasons, 'assessments': [{'ruleId': item.rule.id, 'approval': item.rule.then.recommend, 'scope': item.rule.then.scope, 'state': item.state, 'missingFields': list(item.missing_fields)} for item in assessments]}
