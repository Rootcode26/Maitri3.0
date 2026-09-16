from app.rules.evaluator import (
    evaluate_condition,
    evaluate_rule,
    evaluate_rules,
)
from app.rules.schemas import Rule, RuleCondition


def test_in_condition_matches_allowed_value():
    condition = RuleCondition.model_validate(
        {
            "field": "workforce.permanentEmployeeBand",
            "in": [
                "from_20_to_49",
                "from_50_to_99",
            ],
        }
    )

    application = {
        "workforce": {
            "permanentEmployeeBand": "from_20_to_49",
        }
    }

    assert evaluate_condition(condition, application) is True


def test_in_condition_rejects_value_outside_allowed_values():
    condition = RuleCondition.model_validate(
        {
            "field": "workforce.permanentEmployeeBand",
            "in": [
                "from_20_to_49",
                "from_50_to_99",
            ],
        }
    )

    application = {
        "workforce": {
            "permanentEmployeeBand": "less_than_10",
        }
    }

    assert evaluate_condition(condition, application) is False


def test_in_condition_matches_value_inside_list():
    condition = RuleCondition.model_validate(
        {
            "field": "operations.processesUsed",
            "in": [
                "onsite_effluent_treatment",
            ],
        }
    )

    application = {
        "operations": {
            "processesUsed": [
                "manufacturing_processing",
                "onsite_effluent_treatment",
            ]
        }
    }

    assert evaluate_condition(condition, application) is True


def test_in_condition_rejects_value_not_inside_list():
    condition = RuleCondition.model_validate(
        {
            "field": "operations.processesUsed",
            "in": [
                "onsite_effluent_treatment",
            ],
        }
    )

    application = {
        "operations": {
            "processesUsed": [
                "manufacturing_processing",
                "packaging_storage",
            ]
        }
    }

    assert evaluate_condition(condition, application) is False


def test_all_conditions_must_match():
    rule = Rule.model_validate(
        {
            "id": "TEST-ALL",
            "version": 1,
            "when": {
                "all": [
                    {
                        "field": "operations.projectStage",
                        "in": ["new_unit"],
                    },
                    {
                        "field": "operations.hasBoilerOrPressureVessel",
                        "equals": True,
                    },
                ]
            },
            "then": {
                "recommend": "TEST_APPROVAL",
            },
            "explanation": "Test all conditions.",
            "requiredDocuments": [],
        }
    )

    application = {
        "operations": {
            "projectStage": "new_unit",
            "hasBoilerOrPressureVessel": True,
        }
    }

    assert evaluate_rule(rule, application) is True


def test_all_conditions_fail_when_one_condition_fails():
    rule = Rule.model_validate(
        {
            "id": "TEST-ALL",
            "version": 1,
            "when": {
                "all": [
                    {
                        "field": "operations.projectStage",
                        "in": ["new_unit"],
                    },
                    {
                        "field": "operations.hasBoilerOrPressureVessel",
                        "equals": True,
                    },
                ]
            },
            "then": {
                "recommend": "TEST_APPROVAL",
            },
            "explanation": "Test all conditions.",
            "requiredDocuments": [],
        }
    )

    application = {
        "operations": {
            "projectStage": "new_unit",
            "hasBoilerOrPressureVessel": False,
        }
    }

    assert evaluate_rule(rule, application) is False


def test_any_condition_matches_when_one_condition_is_true():
    rule = Rule.model_validate(
        {
            "id": "TEST-ANY",
            "version": 1,
            "when": {
                "any": [
                    {
                        "field": "operations.projectStage",
                        "in": ["expansion"],
                    },
                    {
                        "field": "operations.hasBoilerOrPressureVessel",
                        "equals": True,
                    },
                ]
            },
            "then": {
                "recommend": "TEST_APPROVAL",
            },
            "explanation": "Test any conditions.",
            "requiredDocuments": [],
        }
    )

    application = {
        "operations": {
            "projectStage": "new_unit",
            "hasBoilerOrPressureVessel": True,
        }
    }

    assert evaluate_rule(rule, application) is True


def test_missing_field_does_not_match():
    condition = RuleCondition.model_validate(
        {
            "field": "operations.nonExistingField",
            "equals": True,
        }
    )

    application = {
        "operations": {}
    }

    assert evaluate_condition(condition, application) is False


def test_evaluate_rules_returns_only_matched_rules():
    rules = [
        Rule.model_validate(
            {
                "id": "TEST-MATCH",
                "version": 1,
                "when": {
                    "all": [
                        {
                            "field": "operations.projectStage",
                            "equals": "new_unit",
                        }
                    ]
                },
                "then": {
                    "recommend": "APPROVAL_A",
                },
                "explanation": "Matching rule.",
                "requiredDocuments": [],
            }
        ),
        Rule.model_validate(
            {
                "id": "TEST-NO-MATCH",
                "version": 1,
                "when": {
                    "all": [
                        {
                            "field": "operations.projectStage",
                            "equals": "expansion",
                        }
                    ]
                },
                "then": {
                    "recommend": "APPROVAL_B",
                },
                "explanation": "Non-matching rule.",
                "requiredDocuments": [],
            }
        ),
    ]

    application = {
        "operations": {
            "projectStage": "new_unit",
        }
    }

    matched = evaluate_rules(rules, application)

    assert [rule.id for rule in matched] == ["TEST-MATCH"]