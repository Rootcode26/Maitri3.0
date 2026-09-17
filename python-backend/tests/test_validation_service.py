import copy
import json
from datetime import datetime, timezone
from pathlib import Path
import unittest

from pydantic import ValidationError
from app.domain.api_contract_models import ValidateRequest, EvaluateResponse
from app.services.validation import validate_application
from app.services.document_policy import DocumentValidationPolicy


def fixture():
    root = Path(__file__).resolve().parents[2]
    request = json.loads((root / 'packages/contracts/examples/evaluations/node/validate.request.json').read_text(encoding='utf-8'))
    request['documents'][0]['extractedData']['pan'] = request['project']['pan']
    evaluation = {
        'rulesVersion': request['rulesVersion'], 'projectId': request['projectId'],
        'evaluatedAt': '2026-09-17T00:00:00Z', 'readinessScore': None, 'blockingIssues': [],
        'approvals': [{
            'key': 'food-licence', 'title': 'Test approval', 'status': 'required',
            'reason': 'Test only', 'ruleId': 'test', 'departmentKey': 'test', 'processingDays': 0,
            'documents': [{
                'key': 'identity-proof', 'name': 'Test PAN document', 'description': 'Test only',
                'formats': ['PDF'], 'maxSizeMb': 1.0, 'filesRequired': 1, 'required': True,
                'mustInclude': [], 'quality': [], 'fieldsToCompare': ['pan'],
            }],
        }],
    }
    return request, evaluation


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.request, self.evaluation = fixture()
        # Synthetic validity specification applies only to this fixture type.
        self.policy = None

    def run_validation(self):
        return validate_application(
            ValidateRequest.model_validate_json(json.dumps(self.request)),
            EvaluateResponse.model_validate_json(json.dumps(self.evaluation)),
            evaluated_at=datetime(2026, 9, 17, tzinfo=timezone.utc),
            policy=self.policy,
        )

    def codes(self, group='blocking_issues'):
        return {issue.code for issue in getattr(self.run_validation(), group)}

    def test_match(self):
        result = self.run_validation()
        self.assertEqual(result.validation_status, 'complete')
        self.assertFalse(result.blocking_issues)
        self.assertEqual(result.document_checks[0].status, 'matched')

    def test_pan_mismatch(self):
        self.request['documents'][0]['extractedData']['pan'] = 'ABCDE5678F'
        self.assertIn('DOCUMENT_DATA_MISMATCH', self.codes())

    def test_missing_question(self):
        self.request['project']['pan'] = None
        self.assertIn('REQUIRED_FIELD_MISSING', self.codes())

    def test_invalid_pan_request(self):
        self.request['project']['pan'] = 'bad'
        with self.assertRaises(ValidationError):
            self.run_validation()

    def test_missing_document(self):
        self.request['documents'] = []
        self.assertIn('REQUIRED_DOCUMENT_MISSING', self.codes())

    def test_gstin_pan_relation(self):
        self.request['project']['gstin'] = '27ABCDE5678F1Z5'
        self.assertIn('IDENTIFIER_RELATION_MISMATCH', self.codes())

    def test_file_checks(self):
        self.policy = DocumentValidationPolicy(expiry_rules=(('food-licence', 'identity-proof', 'Synthetic fixture specifies printed expiry'),))
        self.request['documents'][0].update(fileName='bad.exe', sizeBytes=1000001, fileReadStatus='unreadable', expiresOn='2026-09-16')
        self.assertTrue({'DOCUMENT_FORMAT_NOT_ALLOWED', 'DOCUMENT_TOO_LARGE', 'DOCUMENT_UNREADABLE', 'DOCUMENT_EXPIRED'} <= self.codes())

    def test_size_boundary_and_expiry_today(self):
        self.policy = DocumentValidationPolicy(expiry_rules=(('food-licence', 'identity-proof', 'Synthetic fixture specifies printed expiry'),))
        self.request['documents'][0].update(sizeBytes=1000000, expiresOn='2026-09-17')
        self.assertFalse(self.run_validation().blocking_issues)

    def test_unknown_content_not_passed(self):
        self.request['documents'][0].update(detectedMimeType=None, fileReadStatus='not_checked', extractionStatus='not_run', extractedData=None)
        self.assertEqual(self.run_validation().validation_status, 'review_required')
        self.assertIn('DOCUMENT_EXTRACTION_REVIEW_NEEDED', self.codes('review_items'))

    def test_narrative_review(self):
        self.evaluation['approvals'][0]['documents'][0]['quality'] = ['Must be readable']
        self.assertIn('DOCUMENT_CONTENT_REVIEW_NEEDED', self.codes('review_items'))

    def test_unknown_binding(self):
        self.request['documents'][0]['documentKey'] = 'unknown'
        self.assertIn('UNKNOWN_DOCUMENT_BINDING', self.codes())

    def test_versions(self):
        other = copy.deepcopy(self.request['documents'][0])
        other['version'] = 2
        self.request['documents'].append(other)
        self.assertIn('MULTIPLE_DOCUMENT_VERSIONS', self.codes())

    def test_contradiction(self):
        self.request['project']['boiler'] = 'no'
        self.assertIn('CONTRADICTORY_ANSWERS', self.codes())

    def test_optional_not_required(self):
        self.evaluation['approvals'][0]['documents'][0]['required'] = False
        self.request['documents'] = []
        self.assertFalse(self.run_validation().blocking_issues)

    def name_comparison(self, value):
        self.evaluation['approvals'][0]['documents'][0]['fieldsToCompare'] = ['enterpriseName']
        self.request['documents'][0]['extractedData']['enterpriseName'] = value
        return self.run_validation()

    def test_minor_name_difference_suggests_review_not_replacement(self):
        result = self.name_comparison('Sahyadri Food Pvt. Ltd.')
        self.assertFalse(result.blocking_issues)
        self.assertEqual(result.validation_status, 'review_required')
        self.assertIn('possible spelling', result.review_items[0].suggested_action)
        self.assertEqual(self.request['project']['enterpriseName'], 'Sahyadri Foods Pvt. Ltd.')

    def test_case_whitespace_difference_not_error(self):
        result = self.name_comparison('sahyadri   foods pvt. ltd.')
        self.assertFalse(result.review_items)
        self.assertEqual(result.document_checks[0].status, 'matched')

    def test_different_name_suggests_business_check(self):
        result = self.name_comparison('Unrelated Steel Enterprises')
        self.assertIn('same business/project', result.review_items[0].suggested_action)

    def test_missing_answer_human_readable(self):
        self.request['project']['enterpriseName'] = None
        missing = next(item for item in self.run_validation().blocking_issues if item.field == 'project.enterpriseName')
        self.assertIn('business name', missing.message)
        self.assertIn('run validation again', missing.suggested_action)

    def test_format_suggestion_lists_allowed_formats(self):
        self.request['documents'][0]['fileName'] = 'file.exe'
        result = self.run_validation()
        issue = next(item for item in result.blocking_issues if item.code == 'DOCUMENT_FORMAT_NOT_ALLOWED')
        self.assertIn('PDF', issue.suggested_action)
        self.assertIn('renaming', issue.suggested_action)


if __name__ == '__main__':
    unittest.main()
