"""Run from python-backend: python -m unittest discover -s tests/unit/validation -v"""
import json
from copy import deepcopy
from pathlib import Path
import unittest

from pydantic import ValidationError
from app.domain.request_models import EvaluationRequest

EXAMPLES = Path(__file__).resolve().parents[4] / "packages/contracts/examples/evaluations/v2"


class RequestContractTests(unittest.TestCase):
    def setUp(self):
        self.payload = json.loads((EXAMPLES / "textile.request.json").read_text(encoding="utf-8"))

    def test_all_examples(self):
        for path in EXAMPLES.glob("*.request.json"):
            with self.subTest(example=path.name):
                EvaluationRequest.model_validate_json(path.read_text(encoding="utf-8"))

    def test_missing_and_false_are_distinct(self):
        model = EvaluationRequest.model_validate_json((EXAMPLES / "incomplete.request.json").read_text())
        self.assertIsNone(model.operations.has_boiler_or_pressure_vessel)
        self.payload["operations"]["hasBoilerOrPressureVessel"] = False
        model = EvaluationRequest.model_validate_json(json.dumps(self.payload))
        self.assertIs(model.operations.has_boiler_or_pressure_vessel, False)

    def test_bad_payloads(self):
        for name, change in [
            ("unknown field", lambda p: p.update(password="secret")),
            ("numeric string", lambda p: p.update(applicationVersion="1")),
            ("boolean shifts", lambda p: p["operations"].update(operatingShifts=True)),
            ("boolean string", lambda p: p["operations"].update(handlesHazardousChemicals="yes")),
            ("bad date", lambda p: p.update(evaluationDate="not-a-date")),
            ("wrong sector", lambda p: p["sectorDetails"].update(sector="food")),
            ("wrong activity", lambda p: p["operations"].update(primaryActivity="foundry_casting")),
            ("missing envelope", lambda p: p.pop("utilities")),
            ("duplicate documents", lambda p: p["documents"].append(deepcopy(p["documents"][0]))),
            ("capacity units missing", lambda p: p["operations"].update(installedCapacity={"value": 10})),
            ("invalid range", lambda p: p["location"].update(plotAreaBand="huge")),
            ("negative capacity", lambda p: p["operations"].update(installedCapacity={"value": -1, "unit": "tonnes", "period": "month"})),
            ("blank ID", lambda p: p.update(requestId="   ")),
            ("wrong nested field", lambda p: p["businessProfile"].update(employeeCount=24)),
            ("bad status", lambda p: p["documents"][0].update(verificationStatus="approved")),
            ("path filename", lambda p: p["documents"][0].update(fileName="../test.pdf")),
            ("boolean version", lambda p: p.update(applicationVersion=True)),
            ("zero document size", lambda p: p["documents"][0].update(sizeBytes=0)),
        ]:
            with self.subTest(case=name):
                payload = deepcopy(self.payload)
                change(payload)
                with self.assertRaises(ValidationError):
                    EvaluationRequest.model_validate_json(json.dumps(payload))

    def test_alias_round_trip(self):
        model = EvaluationRequest.model_validate_json(json.dumps(self.payload))
        result = json.loads(model.model_dump_json(by_alias=True))
        self.assertIn("businessProfile", result)
        self.assertNotIn("business_profile", result)
        self.assertEqual(result["applicationVersion"], 1)

    def test_missing_boiler_capacity_is_a_completeness_issue(self):
        self.payload["operations"]["hasBoilerOrPressureVessel"] = True
        self.payload["operations"]["boilerCapacityBand"] = None
        EvaluationRequest.model_validate_json(json.dumps(self.payload))

    def test_document_restrictions_not_invented(self):
        self.payload["documents"][0]["mimeType"] = "application/octet-stream"
        self.payload["documents"][0]["sizeBytes"] = 100_000_000
        EvaluationRequest.model_validate_json(json.dumps(self.payload))


if __name__ == "__main__":
    unittest.main()
