from typing import Any

from app.rules.schemas import Rule, RuleCondition


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

    actual_value = get_field_value(application, condition.field)

    if condition.equals is not None:
        return actual_value == condition.equals

    if condition.greaterThan is not None:
        if actual_value is None:
            return False

        try:
            return actual_value > condition.greaterThan
        except TypeError:
            return False

    return False


def evaluate_rule(
    rule: Rule,
    application: dict[str, Any],
) -> bool:
    """
    Evaluate all conditions of a single rule.
    """

    conditions = rule.when

    if conditions.all is not None:
        return all(
            evaluate_condition(condition, application)
            for condition in conditions.all
        )

    if conditions.any is not None:
        return any(
            evaluate_condition(condition, application)
            for condition in conditions.any
        )

    return False


def evaluate_rules(
    rules: list[Rule],
    application: dict[str, Any],
) -> list[Rule]:
    """
    Evaluate all rules and return only the matched rules.
    """

    return [
        rule
        for rule in rules
        if evaluate_rule(rule, application)
    ]