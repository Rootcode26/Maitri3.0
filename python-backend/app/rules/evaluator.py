from typing import Any
from dataclasses import dataclass
from datetime import date
from math import isfinite
from typing import Literal

from app.rules.schemas import Rule, RuleCondition, RuleConditions


def get_field_value(data: dict[str, Any], field: str) -> Any:
    """
    Retrieve a nested value using dot notation.

    Example:
        field = "businessProfile.employeeCount"

        data = {
            "businessProfile": {
                "employeeCount": 24
            }
        }

        returns 24

    Returns None if any part of the path does not exist.
    """
    current: Any = data

    for part in field.split("."):
        if not isinstance(current, dict) or part not in current:
            return None

        current = current[part]

    return current


def evaluate_condition(
    condition: RuleCondition,
    application: dict[str, Any],
) -> bool:
    """
    Evaluate a single rule condition against an application snapshot.
    """

    return assess_condition(condition, application).value is True


def evaluate_rule(
    rule: Rule,
    application: dict[str, Any],
) -> bool:
    """
    Evaluate all conditions of a single rule.
    """

    # Boolean compatibility helper; regulatory consumers use assess_rule.
    return assess_rule(rule, application).state in {'matched', 'needs_review'}


def evaluate_rules(
    rules: list[Rule],
    application: dict[str, Any],
) -> list[Rule]:
    """
    Evaluate all rules and return only the matched rules.
    """

    return [
        rule
        for rule in sorted(rules, key=lambda item: (item.id, item.version))
        if evaluate_rule(rule, application)
    ]


@dataclass(frozen=True)
class ConditionAssessment:
    value: bool | None
    missing_fields: tuple[str, ...] = ()


@dataclass(frozen=True)
class RuleAssessment:
    rule: Rule
    state: Literal['matched', 'not_matched', 'insufficient_information', 'needs_review']
    missing_fields: tuple[str, ...] = ()


def _valid_scalar(value: Any) -> bool:
    return type(value) in (str, int, float, bool) and not (
        isinstance(value, float) and not isfinite(value)
    )


def _compatible(actual: Any, expected: Any) -> bool:
    if not _valid_scalar(actual):
        return False
    if type(actual) in (int, float) and type(expected) in (int, float):
        return True
    return type(actual) is type(expected)


def assess_condition(condition: RuleCondition, application: dict[str, Any]) -> ConditionAssessment:
    # Sector-only inputs are irrelevant outside their declared sector, not missing.
    # Unknown sector remains unknown; never manufacture a false/default value.
    if condition.applicableIndustries is not None:
        industry_field = 'businessProfile.industrySector'
        industry = get_field_value(application, industry_field)
        if industry not in ('food', 'textile', 'steel'):
            return ConditionAssessment(None, (industry_field,))
        if industry not in condition.applicableIndustries:
            return ConditionAssessment(False)
    actual = get_field_value(application, condition.field)
    unknown = ConditionAssessment(None, (condition.field,))
    if actual is None:
        return unknown
    if 'equals' in condition.model_fields_set:
        if not _compatible(actual, condition.equals):
            return unknown
        return ConditionAssessment(actual == condition.equals)
    if 'greaterThan' in condition.model_fields_set:
        if type(actual) not in (int, float) or not _valid_scalar(actual):
            return unknown
        return ConditionAssessment(actual > condition.greaterThan)
    choices = condition.in_ or []
    values = actual if isinstance(actual, list) else [actual]
    if any(not any(_compatible(value, choice) for choice in choices) for value in values):
        return unknown
    return ConditionAssessment(any(_compatible(value, choice) and value == choice for value in values for choice in choices))


def assess_conditions(conditions: RuleConditions, application: dict[str, Any]) -> ConditionAssessment:
    members = conditions.all if conditions.all is not None else conditions.any
    results = [assess_condition(condition, application) for condition in members]
    values = [result.value for result in results]
    # Three-valued logic: false AND unknown=false; true OR unknown=true.
    if conditions.all is not None and False in values:
        return ConditionAssessment(False)
    if conditions.any is not None and True in values:
        return ConditionAssessment(True)
    missing = tuple(sorted({field for result in results for field in result.missing_fields}))
    if None in values:
        return ConditionAssessment(None, missing)
    return ConditionAssessment(all(values) if conditions.all is not None else any(values))


def assess_rule(rule: Rule, application: dict[str, Any], *, evaluation_date: date | None = None) -> RuleAssessment:
    condition = assess_conditions(rule.when, application)
    if condition.value is False:
        return RuleAssessment(rule, 'not_matched')
    missing = set(condition.missing_fields)
    for field in rule.decisionInputs:
        value = get_field_value(application, field)
        if not _valid_scalar(value) or (isinstance(value, str) and not value.strip()):
            missing.add(field)
    if rule.jurisdiction == 'MH':
        state = get_field_value(application, 'location.stateCode')
        if state is None:
            missing.add('location.stateCode')
        elif state != 'MH':
            return RuleAssessment(rule, 'not_matched')
    if rule.effectiveFrom or rule.effectiveTo:
        if evaluation_date is None:
            missing.add('context.evaluationDate')
        elif (rule.effectiveFrom and evaluation_date < rule.effectiveFrom) or (rule.effectiveTo and evaluation_date > rule.effectiveTo):
            return RuleAssessment(rule, 'not_matched')
    if condition.value is None or missing:
        return RuleAssessment(rule, 'insufficient_information', tuple(sorted(missing)))
    return RuleAssessment(rule, 'matched' if rule.verification == 'VERIFIED' else 'needs_review')


def assess_rules(rules: list[Rule], application: dict[str, Any], *, evaluation_date: date | None = None) -> list[RuleAssessment]:
    return [assess_rule(rule, application, evaluation_date=evaluation_date) for rule in sorted(rules, key=lambda item: (item.id, item.version))]
