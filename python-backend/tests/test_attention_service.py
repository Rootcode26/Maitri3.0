from dataclasses import dataclass
import unittest

from pydantic import ValidationError

from app.domain.api_contract_models import (
    ATTENTION_ASSESSMENT_DISCLAIMER,
    AttentionAssessment,
    ProjectProfile,
)
from app.services.attention import calculate_attention_assessment


@dataclass(frozen=True)
class Findings:
    blocking_issues: tuple[object, ...] = ()
    warnings: tuple[object, ...] = ()
    review_items: tuple[object, ...] = ()


def project(**answers):
    return ProjectProfile.model_validate(answers)


def findings(*, blocking=0, warnings=0, reviews=0):
    marker = object()
    return Findings(
        blocking_issues=(marker,) * blocking,
        warnings=(marker,) * warnings,
        review_items=(marker,) * reviews,
    )


def assessment_payload(score, level, *, factors=None):
    return {
        "score": score,
        "level": level,
        "policyVersion": "prototype-1",
        "factors": factors if factors is not None else ([{
            "code": "BOILER_DECLARED",
            "label": "Test factor",
            "points": score,
            "explanation": "Used to verify the contract boundary.",
        }] if score else []),
        "disclaimer": ATTENTION_ASSESSMENT_DISCLAIMER,
    }


class AttentionServiceTests(unittest.TestCase):
    def test_zero_score_has_no_factors(self):
        result = calculate_attention_assessment(project(), findings())
        self.assertEqual(result.score, 0)
        self.assertEqual(result.level, "standard")
        self.assertEqual(result.factors, [])

    def test_each_business_factor(self):
        cases = [
            ({"hazardousChemicals": "yes"}, "HAZARDOUS_CHEMICALS", 15),
            ({"hazardousWaste": "yes"}, "HAZARDOUS_WASTE", 15),
            ({"boiler": "yes"}, "BOILER_DECLARED", 10),
            ({"wetProcessing": "yes"}, "WET_PROCESSING", 10),
            ({"furnaceType": "Induction furnace"}, "FURNACE_DECLARED", 10),
        ]
        for answers, code, points in cases:
            with self.subTest(code=code):
                result = calculate_attention_assessment(project(**answers), findings())
                self.assertEqual(result.score, points)
                self.assertEqual([factor.code for factor in result.factors], [code])

    def test_none_furnace_does_not_add_points(self):
        result = calculate_attention_assessment(project(furnaceType="None"), findings())
        self.assertEqual(result.score, 0)

    def test_multiple_factors_are_added(self):
        result = calculate_attention_assessment(project(
            hazardousChemicals="yes",
            hazardousWaste="yes",
            boiler="yes",
            wetProcessing="yes",
            furnaceType="Cupola",
        ), findings())
        self.assertEqual(result.score, 60)
        self.assertEqual(result.level, "high_attention")

    def test_blocking_points_are_capped_at_twenty(self):
        result = calculate_attention_assessment(project(), findings(blocking=12))
        self.assertEqual(result.score, 20)
        self.assertEqual(result.factors[0].points, 20)
        self.assertIn("12 blocking corrections", result.factors[0].explanation)

    def test_warning_points_are_capped_at_ten(self):
        result = calculate_attention_assessment(project(), findings(warnings=12))
        self.assertEqual(result.score, 10)
        self.assertEqual(result.factors[0].points, 10)
        self.assertIn("12 items to double-check", result.factors[0].explanation)

    def test_review_points_are_capped_at_ten(self):
        result = calculate_attention_assessment(project(), findings(reviews=12))
        self.assertEqual(result.score, 10)
        self.assertEqual(result.factors[0].points, 10)
        self.assertIn("12 manual review items", result.factors[0].explanation)

    def test_total_score_is_capped_at_one_hundred(self):
        result = calculate_attention_assessment(project(
            hazardousChemicals="yes",
            hazardousWaste="yes",
            boiler="yes",
            wetProcessing="yes",
            furnaceType="Electric arc furnace",
        ), findings(blocking=20, warnings=20, reviews=20))
        self.assertEqual(result.score, 100)

    def test_exact_level_boundaries(self):
        for score, level in [
            (19, "standard"),
            (20, "elevated"),
            (39, "elevated"),
            (40, "high_attention"),
        ]:
            with self.subTest(score=score):
                result = AttentionAssessment.model_validate(assessment_payload(score, level))
                self.assertEqual(result.level, level)

    def test_duplicate_factor_codes_are_rejected(self):
        factor = {
            "code": "BOILER_DECLARED",
            "label": "Boiler declared",
            "points": 10,
            "explanation": "A declared boiler needs manual review.",
        }
        with self.assertRaises(ValidationError):
            AttentionAssessment.model_validate(assessment_payload(
                20,
                "elevated",
                factors=[factor, factor],
            ))

    def test_invalid_score_and_level_combinations_are_rejected(self):
        invalid_payloads = [
            assessment_payload(-1, "standard"),
            assessment_payload(101, "high_attention"),
            assessment_payload(10, "elevated"),
            assessment_payload(20, "standard"),
            assessment_payload(9, "standard", factors=[{
                "code": "BOILER_DECLARED",
                "label": "Boiler declared",
                "points": 10,
                "explanation": "A declared boiler needs manual review.",
            }]),
        ]
        for payload in invalid_payloads:
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                AttentionAssessment.model_validate(payload)

    def test_negative_factor_points_are_rejected(self):
        payload = assessment_payload(0, "standard", factors=[{
            "code": "BOILER_DECLARED",
            "label": "Boiler declared",
            "points": -1,
            "explanation": "A declared boiler needs manual review.",
        }])
        with self.assertRaises(ValidationError):
            AttentionAssessment.model_validate(payload)

    def test_same_input_is_deterministic(self):
        profile = project(hazardousWaste="yes", boiler="yes")
        validation = findings(blocking=2, warnings=3, reviews=1)
        first = calculate_attention_assessment(profile, validation)
        second = calculate_attention_assessment(profile, validation)
        self.assertEqual(first.model_dump(), second.model_dump())

    def test_unscored_profile_fields_do_not_affect_result(self):
        baseline = calculate_attention_assessment(project(), findings()).model_dump()
        unscored_answers = {
            "enterpriseName": "Example Enterprise",
            "organisationType": "private-limited",
            "pan": "ABCDE1234F",
            "gstin": "27ABCDE1234F1Z5",
            "cin": "U12345MH2026PTC123456",
            "udyam": "UDYAM-MH-00-0000001",
            "district": "Pune",
            "taluka": "Khed",
            "pincode": "410501",
            "permanent": "500 or more",
            "contract": "50 or more",
            "womenNight": "yes",
        }
        for field, value in unscored_answers.items():
            with self.subTest(field=field):
                result = calculate_attention_assessment(project(**{field: value}), findings())
                self.assertEqual(result.model_dump(), baseline)


if __name__ == "__main__":
    unittest.main()
