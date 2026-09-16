from app.rules.schemas import Rule
from app.services.recommendation import build_recommendations


def test_same_approval_is_grouped():
    rules = [
        Rule.model_validate(
            {
                "id": "RULE-A",
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
                    "recommend": "FACTORY_LABOUR",
                },
                "explanation": "First factory condition.",
                "requiredDocuments": [
                    "site_floor_layout",
                ],
            }
        ),
        Rule.model_validate(
            {
                "id": "RULE-B",
                "version": 1,
                "when": {
                    "all": [
                        {
                            "field": "operations.hasBoilerOrPressureVessel",
                            "equals": True,
                        }
                    ]
                },
                "then": {
                    "recommend": "FACTORY_LABOUR",
                },
                "explanation": "Second factory condition.",
                "requiredDocuments": [
                    "machinery_process_description",
                ],
            }
        ),
    ]

    recommendations = build_recommendations(rules)

    assert len(recommendations) == 1

    recommendation = recommendations[0]

    assert recommendation["approvalCode"] == "FACTORY_LABOUR"

    assert recommendation["matchedRuleIds"] == [
        "RULE-A",
        "RULE-B",
    ]

    assert recommendation["requiredDocuments"] == [
        "site_floor_layout",
        "machinery_process_description",
    ]