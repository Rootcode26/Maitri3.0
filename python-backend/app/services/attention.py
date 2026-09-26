"""Transparent, deterministic application attention assessment."""
from typing import Protocol, Sized

from app.domain.api_contract_models import (
    ATTENTION_ASSESSMENT_DISCLAIMER,
    AttentionAssessment,
    AttentionFactor,
    ProjectProfile,
)


class ValidationFindings(Protocol):
    blocking_issues: Sized
    warnings: Sized
    review_items: Sized


def _factor(code: str, label: str, points: int, explanation: str) -> AttentionFactor:
    return AttentionFactor.model_validate({
        "code": code,
        "label": label,
        "points": points,
        "explanation": explanation,
    })


def calculate_attention_assessment(
    project: ProjectProfile,
    validation_result: ValidationFindings,
) -> AttentionAssessment:
    """Calculate how much manual attention the completed validation may need."""
    factors: list[AttentionFactor] = []

    business_factors = (
        (
            project.hazardous_chemicals == "yes",
            "HAZARDOUS_CHEMICALS",
            "Hazardous chemicals declared",
            15,
            "The declared process may need additional manual review.",
        ),
        (
            project.hazardous_waste == "yes",
            "HAZARDOUS_WASTE",
            "Hazardous waste declared",
            15,
            "The declared waste handling may need additional manual review.",
        ),
        (
            project.boiler == "yes",
            "BOILER_DECLARED",
            "Boiler declared",
            10,
            "The declared boiler may need additional manual review.",
        ),
        (
            project.wet_processing == "yes",
            "WET_PROCESSING",
            "Wet processing declared",
            10,
            "The declared wet process may need additional manual review.",
        ),
        (
            project.furnace_type not in {None, "None"},
            "FURNACE_DECLARED",
            "Furnace declared",
            10,
            "The declared furnace may need additional manual review.",
        ),
    )
    for applies, code, label, points, explanation in business_factors:
        if applies:
            factors.append(_factor(code, label, points, explanation))

    finding_factors = (
        (
            len(validation_result.blocking_issues),
            5,
            20,
            "BLOCKING_CORRECTIONS",
            "Blocking corrections",
            "blocking correction",
            "blocking corrections",
        ),
        (
            len(validation_result.warnings),
            2,
            10,
            "ITEMS_TO_DOUBLE_CHECK",
            "Items to double-check",
            "item to double-check",
            "items to double-check",
        ),
        (
            len(validation_result.review_items),
            2,
            10,
            "MANUAL_REVIEW_ITEMS",
            "Manual review items",
            "manual review item",
            "manual review items",
        ),
    )
    for count, points_each, maximum, code, label, singular, plural in finding_factors:
        if count:
            points = min(maximum, count * points_each)
            noun = singular if count == 1 else plural
            factors.append(_factor(
                code,
                label,
                points,
                f"{count} {noun} {'was' if count == 1 else 'were'} found during validation.",
            ))

    score = min(100, sum(factor.points for factor in factors))
    level = "standard" if score < 20 else "elevated" if score < 40 else "high_attention"
    return AttentionAssessment.model_validate({
        "score": score,
        "level": level,
        "policyVersion": "prototype-1",
        "factors": [factor.model_dump(by_alias=True) for factor in factors],
        "disclaimer": ATTENTION_ASSESSMENT_DISCLAIMER,
    })
