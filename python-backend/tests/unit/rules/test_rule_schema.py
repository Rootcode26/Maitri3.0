import unittest
from pydantic import ValidationError
from app.rules.schemas import Rule, RuleCondition, RuleConditions


def rule_data():
    return {'id': 'TEST-001', 'version': 1, 'when': {'all': [{'field': 'businessProfile.industrySector', 'equals': 'food'}]}, 'then': {'recommend': 'food-licence'}, 'explanation': 'Test rule, not law.'}


class SchemaTests(unittest.TestCase):
    def test_legacy_valid_rule(self):
        self.assertEqual(Rule.model_validate(rule_data()).verification, 'PROTOTYPE_ASSUMPTION')

    def test_invalid_operators(self):
        for data in [{}, {'equals': True, 'in': [True]}, {'equals': None}, {'in': []}, {'greaterThan': True}, {'greaterThan': '5'}, {'equals': float('inf')}, {'lessThan': 5}, {'in': [None]}]:
            with self.subTest(data=data), self.assertRaises(ValidationError):
                RuleCondition.model_validate({'field': 'operations.x', **data})

    def test_invalid_groups(self):
        condition = {'field': 'operations.x', 'equals': False}
        for data in [{}, {'all': []}, {'any': []}, {'all': None}, {'all': [condition], 'any': [condition]}, {'all': [condition], 'any': None}]:
            with self.subTest(data=data), self.assertRaises(ValidationError):
                RuleConditions.model_validate(data)

    def test_false_equals_valid(self):
        self.assertFalse(RuleCondition.model_validate({'field': 'x', 'equals': False}).equals)

    def test_verified_needs_evidence(self):
        data = rule_data()
        data['verification'] = 'VERIFIED'
        with self.assertRaises(ValidationError):
            Rule.model_validate(data)

    def test_prototype_cannot_assert_required(self):
        data = rule_data()
        data['then']['status'] = 'required'
        with self.assertRaises(ValidationError):
            Rule.model_validate(data)

    def test_version_and_extra_fields(self):
        for change in [{'version': True}, {'version': 0}, {'unknown': 'ignored'}]:
            with self.subTest(change=change), self.assertRaises(ValidationError):
                Rule.model_validate({**rule_data(), **change})

    def test_duplicate_document_keys(self):
        data = rule_data()
        data['requiredDocuments'] = ['pan', 'pan']
        with self.assertRaises(ValidationError):
            Rule.model_validate(data)
