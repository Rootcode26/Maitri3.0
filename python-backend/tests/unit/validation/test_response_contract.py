import json
from copy import deepcopy
from pathlib import Path
import unittest

from pydantic import ValidationError
from app.domain.response_models import Person2AssessmentResponse

EXAMPLES = Path(__file__).resolve().parents[4] / "packages/contracts/examples/evaluations/v2/person2"


class ResponseContractTests(unittest.TestCase):
    def setUp(self):
        self.payload = json.loads((EXAMPLES / "not-configured.response.json").read_text())

    def test_all_examples(self):
        for path in EXAMPLES.glob("*.response.json"):
            with self.subTest(example=path.name):
                Person2AssessmentResponse.model_validate_json(path.read_text())

    def test_unfinished_results_reject_final_claims(self):
        changes = [
            lambda p: p["readiness"].update(score=80),
            lambda p: p["readiness"].update(readyToSubmit=True),
            lambda p: p["risk"].update(score=0),
            lambda p: p["risk"].update(level="low"),
            lambda p: p["risk"].update(factors=[{"code": "TEST", "points": 1, "explanation": "Test"}]),
            lambda p: p["risk"].update(scoringPolicyVersion="policy-1"),
            lambda p: p["readiness"].update(sections=[{"code": "TEST", "earnedPoints": 1, "maximumPoints": 1}]),
        ]
        for change in changes:
            with self.subTest(change=change):
                payload = deepcopy(self.payload)
                change(payload)
                with self.assertRaises(ValidationError):
                    Person2AssessmentResponse.model_validate_json(json.dumps(payload))

    def test_findings_and_counts_must_match(self):
        for changes in [{"blockingErrorCount": 2}, {"warningCount": 1}, {"blockingErrorCount": -1}]:
            with self.subTest(changes=changes):
                payload = deepcopy(self.payload)
                payload["readiness"].update(changes)
                with self.assertRaises(ValidationError):
                    Person2AssessmentResponse.model_validate_json(json.dumps(payload))

    def test_complete_does_not_mean_passed(self):
        payload = json.loads((EXAMPLES / "complete-with-errors.response.json").read_text())
        result = Person2AssessmentResponse.model_validate_json(json.dumps(payload))
        self.assertEqual(result.readiness.assessment_status, "complete")
        self.assertFalse(result.readiness.ready_to_submit)

    def test_invalid_complete_results(self):
        base = json.loads((EXAMPLES / "complete.response.json").read_text())
        changes = [
            lambda p: p["readiness"].update(score=101),
            lambda p: p["readiness"].update(score=None),
            lambda p: p["risk"].update(scoringPolicyVersion=None),
            lambda p: p["risk"].update(missingFields=["operations.primaryActivity"]),
            lambda p: p["risk"].update(level="unknown"),
            lambda p: p["readiness"].update(score="100"),
            lambda p: p["readiness"].update(readyToSubmit="true"),
            lambda p: p["readiness"]["sections"][0].update(earnedPoints=101),
            lambda p: p["risk"].update(score=10, factors=[]),
            lambda p: p.update(recommendations=[]),
        ]
        for change in changes:
            with self.subTest(change=change):
                payload = deepcopy(base)
                change(payload)
                with self.assertRaises(ValidationError):
                    Person2AssessmentResponse.model_validate_json(json.dumps(payload))

    def test_insufficient_information_requires_missing_fields(self):
        payload = json.loads((EXAMPLES / "insufficient-information.response.json").read_text())
        payload["risk"]["missingFields"] = []
        with self.assertRaises(ValidationError):
            Person2AssessmentResponse.model_validate_json(json.dumps(payload))

    def test_round_trip(self):
        result = Person2AssessmentResponse.model_validate_json(json.dumps(self.payload))
        self.assertEqual(json.loads(result.model_dump_json(by_alias=True)), self.payload)


if __name__ == "__main__":
    unittest.main()
