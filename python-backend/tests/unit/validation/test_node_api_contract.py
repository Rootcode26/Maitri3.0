import json
from copy import deepcopy
from pathlib import Path
import unittest
from pydantic import ValidationError
from app.domain.api_contract_models import EvaluateRequest, EvaluateResponse, ValidateRequest, ValidateResponse

ROOT = Path(__file__).resolve().parents[4]
EXAMPLES = ROOT / "packages/contracts/examples/evaluations/node"


class NodeApiContractTests(unittest.TestCase):
    def test_original_markdown_contract(self):
        text = (ROOT / "api-contract.md").read_text(encoding="utf-8")
        request, end = json.JSONDecoder().raw_decode(text[text.index("{"):])
        rest = text[text.index("{") + end:]
        response, _ = json.JSONDecoder().raw_decode(rest[rest.index("{"):])
        EvaluateRequest.model_validate_json(json.dumps(request))
        EvaluateResponse.model_validate_json(json.dumps(response))

    def test_examples(self):
        for name, model in [
            ("evaluate.request.json", EvaluateRequest), ("evaluate.response.json", EvaluateResponse),
            ("validate.request.json", ValidateRequest), ("validate.response.json", ValidateResponse),
            ("validate.not-evaluated.response.json", ValidateResponse),
        ]:
            with self.subTest(example=name):
                model.model_validate_json((EXAMPLES / name).read_text(encoding="utf-8"))

    def test_no_silent_answer_conversion(self):
        payload = json.loads((EXAMPLES / "evaluate.request.json").read_text(encoding="utf-8"))
        for answer in [True, False, "true", "", 0]:
            with self.subTest(answer=answer):
                payload["project"]["boiler"] = answer
                with self.assertRaises(ValidationError):
                    EvaluateRequest.model_validate_json(json.dumps(payload))
        payload["project"]["boiler"] = None
        model = EvaluateRequest.model_validate_json(json.dumps(payload))
        self.assertIsNone(model.project.boiler)

    def test_drafts_are_accepted(self):
        EvaluateRequest.model_validate_json(json.dumps({"rulesVersion": "2026.09", "projectId": "test", "project": {}}))

    def test_invalid_upload_requests(self):
        base = json.loads((EXAMPLES / "validate.request.json").read_text(encoding="utf-8"))
        changes = [
            lambda p: p.update(projectVersion="1"),
            lambda p: p.update(requirements=[]),
            lambda p: p["documents"][0].update(fileName="../secret.pdf"),
            lambda p: p["documents"][0].update(extractionStatus="not_run"),
            lambda p: p["documents"].append(deepcopy(p["documents"][0])),
            lambda p: p["documents"][0].update(sizeBytes=0),
        ]
        for change in changes:
            payload = deepcopy(base)
            change(payload)
            with self.subTest(change=change), self.assertRaises(ValidationError):
                ValidateRequest.model_validate_json(json.dumps(payload))

    def test_unresolved_checks_cannot_pass(self):
        payload = json.loads((EXAMPLES / "validate.response.json").read_text(encoding="utf-8"))
        payload["validationStatus"] = "complete"
        with self.assertRaises(ValidationError):
            ValidateResponse.model_validate_json(json.dumps(payload))

    def test_issue_groups_and_timezone(self):
        base = json.loads((EXAMPLES / "validate.response.json").read_text(encoding="utf-8"))
        for change in [
            lambda p: p.update(evaluatedAt="2026-09-17T10:15:00"),
            lambda p: p["blockingIssues"][0].update(severity="warning"),
        ]:
            payload = deepcopy(base)
            change(payload)
            with self.assertRaises(ValidationError):
                ValidateResponse.model_validate_json(json.dumps(payload))

    def test_aliases(self):
        model = EvaluateRequest.model_validate_json((EXAMPLES / "evaluate.request.json").read_text(encoding="utf-8"))
        result = json.loads(model.model_dump_json(by_alias=True))
        self.assertIn("enterpriseName", result["project"])
        self.assertNotIn("enterprise_name", result["project"])


if __name__ == "__main__":
    unittest.main()
