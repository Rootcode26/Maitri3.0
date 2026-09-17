import unittest
from app.rules.schemas import RuleCondition, Rule, RuleConditions
from app.rules.evaluator import assess_condition, assess_conditions, assess_rule, evaluate_rules


class AssessmentTests(unittest.TestCase):
    def condition(self, operator):
        return RuleCondition.model_validate({'field': 'x.y', **operator})

    def test_equals_and_missing(self):
        condition = self.condition({'equals': True})
        self.assertTrue(assess_condition(condition, {'x': {'y': True}}).value)
        self.assertFalse(assess_condition(condition, {'x': {'y': False}}).value)
        self.assertIsNone(assess_condition(condition, {}).value)
        self.assertIsNone(assess_condition(condition, {'x': {'y': 1}}).value)

    def test_numeric(self):
        condition = self.condition({'greaterThan': 5})
        self.assertTrue(assess_condition(condition, {'x': {'y': 6}}).value)
        self.assertFalse(assess_condition(condition, {'x': {'y': 5}}).value)
        for value in [None, True, '6', float('nan'), float('inf'), {}]:
            self.assertIsNone(assess_condition(condition, {'x': {'y': value}}).value)

    def test_membership_scalar_list_and_invalid(self):
        condition = self.condition({'in': ['a', 'b']})
        for value in ['a', ['c', 'b']]:
            self.assertTrue(assess_condition(condition, {'x': {'y': value}}).value)
        self.assertFalse(assess_condition(condition, {'x': {'y': []}}).value)
        self.assertIsNone(assess_condition(condition, {'x': {'y': ['a', None]}}).value)

    def test_three_valued_groups(self):
        for group, known, expected in [('all', False, False), ('all', True, None), ('any', True, True), ('any', False, None)]:
            conditions = RuleConditions.model_validate({group: [{'field': 'known', 'equals': True}, {'field': 'missing', 'equals': True}]})
            self.assertIs(assess_conditions(conditions, {'known': known}).value, expected)

    def test_missing_decision_inputs(self):
        rule = Rule.model_validate({'id': 'A', 'version': 1, 'when': {'all': [{'field': 'known', 'equals': True}]}, 'then': {'recommend': 'food-licence'}, 'explanation': 'Test', 'decisionInputs': ['turnover']})
        result = assess_rule(rule, {'known': True})
        self.assertEqual(result.state, 'insufficient_information')
        self.assertEqual(result.missing_fields, ('turnover',))

    def test_stable_order(self):
        rules = [Rule.model_validate({'id': key, 'version': 1, 'when': {'all': [{'field': 'known', 'equals': True}]}, 'then': {'recommend': 'food-licence'}, 'explanation': 'Test'}) for key in ['Z', 'A']]
        self.assertEqual([rule.id for rule in evaluate_rules(rules, {'known': True})], ['A', 'Z'])
