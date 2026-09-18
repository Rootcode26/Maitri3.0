import json
import tempfile
import unittest
from pathlib import Path
from datetime import date
from app.rules.engine import evaluate_project
from app.rules.loader import load_version, load_rules, load_rule
from app.rules.schemas import DependencySpec, RuleCondition
from app.rules.evaluator import assess_condition
from app.services.dependency import DependencyEdge, calculate_dependencies

ROOT = Path(__file__).resolve().parents[4]
SOURCE = {'organization': 'MPCB', 'title': 'Consent workflow', 'url': 'https://www.mpcb.gov.in/en/consentmgt/water-and-air-act'}


class EngineTests(unittest.TestCase):
    def test_version_coverage_and_internal_business_rule(self):
        rules = load_version('2026.09')
        self.assertEqual(len(rules), 6)
        self.assertEqual({rule.then.recommend for rule in rules if rule.then.scope == 'approval'}, {'food-licence', 'factory-registration', 'fire-noc', 'consent-to-operate', 'boiler-registration'})
        self.assertEqual(next(rule for rule in rules if rule.id == 'BUS-001').then.scope, 'internal_prerequisite')

    def test_unsupported_versions(self):
        for value in ['../2026.09', '2026.08', '', '2026.09/']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                load_version(value)

    def test_direct_loader_matches_versioned_loader(self):
        # The rule set has a single source of truth under app/rules/sets. This
        # guards that the raw directory loader and the manifest-validated version
        # loader agree on the same canonical files.
        canonical = ROOT / 'python-backend/app/rules/sets/2026.09'
        loaded = load_rules(canonical)
        self.assertEqual([item.model_dump() for item in loaded], [item.model_dump() for item in load_version('2026.09')])

    def test_food_flat_request_and_multiple_approvals(self):
        project = {'industry': 'food', 'primaryActivity': 'Food & beverage processing', 'boiler': 'yes', 'hazardousChemicals': 'yes', 'processes': []}
        result = evaluate_project(project, '2026.09', jurisdiction='MH', evaluation_date=date(2026, 9, 17))
        self.assertEqual(len(result['approvals']), 5)
        self.assertTrue(result['integrationIssues'])
        # Application-policy checklist: applicable approvals commit to "required",
        # and their must-submit documents are marked required.
        food = next(item for item in result['approvals'] if item['key'] == 'food-licence')
        self.assertEqual(food['status'], 'required')
        self.assertTrue(any(document['required'] for document in food['documents']))
        self.assertNotIn('BUSINESS_REGISTRATION', [item['key'] for item in result['approvals']])

    def test_all_request_examples_do_not_assert_exemptions(self):
        for sector in ['food', 'textile', 'steel', 'incomplete']:
            path = ROOT / 'packages/contracts/examples/evaluations/v2' / f'{sector}.request.json'
            request = json.loads(path.read_text(encoding='utf-8'))
            # Existing v2 fixtures are nested snapshots, not the finalized flat API.
            from app.rules.evaluator import assess_rules
            snapshot = request.get('project', request)
            results = assess_rules(load_version('2026.09'), snapshot)
            self.assertTrue(results)
            if sector == 'incomplete':
                self.assertTrue(any(item.state == 'insufficient_information' for item in results))

    def test_no_state_inference(self):
        result = evaluate_project({'industry': 'steel', 'district': 'Pune'}, '2026.09')
        self.assertIn('location.stateCode', next(item for item in result['assessments'] if item['ruleId'] == 'FACT-001')['missingFields'])
        with self.assertRaises(ValueError):
            evaluate_project({}, '2026.09', jurisdiction='KA')

    def test_conditional_documents_and_verified_metadata(self):
        # water-report is now an always-listed "recommended" (may-be-needed) item
        # rather than gated on a hidden regulatory input.
        result = evaluate_project({'industry': 'food', 'hazardousChemicals': 'yes'}, '2026.09', jurisdiction='MH')
        food = next(item for item in result['approvals'] if item['key'] == 'food-licence')
        water = next(item for item in food['documents'] if item['key'] == 'water-report')
        self.assertFalse(water['required'])
        self.assertTrue(any(document['required'] for document in food['documents']))
        consent = next(rule for rule in load_version('2026.09') if rule.id == 'ENV-004')
        self.assertTrue(all(document.verification == 'VERIFIED' for document in consent.requiredDocuments))
        self.assertTrue(all('prototype application' in document.policyNote for document in consent.requiredDocuments))

    def test_garment_not_definitively_pollution_required(self):
        result = evaluate_project({'industry': 'textile', 'primaryActivity': 'Garment manufacturing', 'wetProcessing': 'no', 'hazardousChemicals': 'no', 'hazardousWaste': 'no', 'boiler': 'no', 'processes': []}, '2026.09', jurisdiction='MH')
        self.assertFalse(any(item['key'] == 'consent-to-operate' and item['status'] == 'required' for item in result['approvals']))

    def test_pollution_ignores_irrelevant_sector_fields(self):
        from app.rules.evaluator import assess_rule
        from app.rules.normalizer import normalize_project
        rule = next(rule for rule in load_version('2026.09') if rule.id == 'ENV-004')
        for sector, activity, details, expected in [
            ('food', 'Food & beverage processing', {}, ()),
            ('textile', 'Garment manufacturing', {'wetProcessing': None}, ('sectorDetails.involvesDyeingOrBleaching',)),
            ('steel', 'Structural fabrication', {'furnaceType': None}, ('sectorDetails.furnaceType',)),
        ]:
            with self.subTest(sector=sector):
                application = normalize_project({'industry': sector, 'primaryActivity': activity, 'hazardousChemicals': 'no', 'hazardousWaste': 'no', **details})
                application['location']['stateCode'] = 'MH'
                assessment = assess_rule(rule, application)
                sector_missing = tuple(field for field in assessment.missing_fields if field.startswith('sectorDetails.'))
                self.assertEqual(sector_missing, expected)
                self.assertEqual(assessment.state, 'not_matched' if sector == 'food' else 'insufficient_information')

    def test_sector_pollution_positive_and_negative_values(self):
        from app.rules.evaluator import assess_rule
        from app.rules.normalizer import normalize_project
        rule = next(rule for rule in load_version('2026.09') if rule.id == 'ENV-004')
        for sector, activity, details, expected in [
            ('textile', 'Garment manufacturing', {'wetProcessing': 'yes'}, 'needs_review'),
            ('textile', 'Garment manufacturing', {'wetProcessing': 'no'}, 'not_matched'),
            ('steel', 'Structural fabrication', {'furnaceType': 'Induction furnace'}, 'needs_review'),
            ('steel', 'Structural fabrication', {'furnaceType': 'None'}, 'not_matched'),
        ]:
            with self.subTest(sector=sector, details=details):
                application = normalize_project({'industry': sector, 'primaryActivity': activity, 'hazardousChemicals': 'no', 'hazardousWaste': 'no', **details})
                application['location']['stateCode'] = 'MH'
                application['regulatory'] = {'consentCategory': 'confirmed-by-owner', 'consentExemptionConfirmed': False, 'operationStage': 'operation'}
                self.assertEqual(assess_rule(rule, application).state, expected)

    def test_sector_guard_unknown_industry_is_not_a_negative(self):
        condition = RuleCondition.model_validate({'field': 'sectorDetails.furnaceType', 'applicableIndustries': ['steel'], 'in': ['induction']})
        for industry in [None, 'unsupported']:
            result = assess_condition(condition, {'businessProfile': {'industrySector': industry}})
            self.assertIsNone(result.value)
            self.assertEqual(result.missing_fields, ('businessProfile.industrySector',))
        result = assess_condition(condition, {'businessProfile': {'industrySector': 'food'}, 'sectorDetails': {'furnaceType': 'induction'}})
        self.assertIs(result.value, False)

    def test_loader_duplicates_and_bad_operators(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original = load_version('2026.09')[0].model_dump(mode='json', by_alias=True, exclude_unset=True)
            (root / 'a.yaml').write_text(json.dumps(original), encoding='utf-8')
            (root / 'b.yaml').write_text(json.dumps(original), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Duplicate rule ID'):
                load_rules(root)
            (root / 'c.yaml').write_text('{"id":"a", "id":"b"}', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Duplicate rule property'):
                load_rule(root / 'c.yaml')

    def test_mixed_boolean_numeric_choices_do_not_match(self):
        condition = RuleCondition.model_validate({'field': 'x', 'in': [True, 2]})
        self.assertIs(assess_condition(condition, {'x': 1}).value, False)

    def test_deterministic_results(self):
        project = {'industry': 'steel', 'boiler': 'yes'}
        self.assertEqual(evaluate_project(project, '2026.09'), evaluate_project(project, '2026.09'))

    def test_research_review_is_kept_without_blocking_applicant(self):
        for sector in ['food', 'textile', 'steel', None]:
            with self.subTest(sector=sector):
                result = evaluate_project({'industry': sector}, '2026.09', jurisdiction='MH')
                self.assertFalse(result['submissionBlocked'])
                self.assertTrue(result['reviewReasons'])

    def test_unverified_documents_still_carry_preparation_notes(self):
        # The application-policy checklist commits to "required", but unverified
        # documents still generate an officer preparation note in the audit trail.
        result = evaluate_project({'industry': 'food'}, '2026.09', jurisdiction='MH')
        self.assertTrue(any('preparation suggestion' in item['message'] for item in result['integrationIssues']))

    def test_declared_dependencies_reach_submission_issues(self):
        result = evaluate_project({'industry': 'steel', 'boiler': 'yes'}, '2026.09', jurisdiction='MH', stage='registration')
        self.assertIn('boiler-registration', result['dependencies']['needsReview'])
        self.assertTrue(any('Unresolved prerequisite' in issue['message'] for issue in result['integrationIssues']))
        self.assertFalse(result['submissionBlocked'])

    def test_manifest_pins_revisions_and_rejects_missing_pin(self):
        import shutil
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'python-backend/app/rules/sets/2026.09', root / '2026.09')
            path = root / '2026.09/manifest.json'
            manifest = json.loads(path.read_text(encoding='utf-8'))
            manifest['ruleVersions']['ENV-004'] = 999
            path.write_text(json.dumps(manifest), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'pinned rule versions'):
                load_version('2026.09', root=root)
            del manifest['ruleVersions']
            path.write_text(json.dumps(manifest), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'pinned ruleVersions'):
                load_version('2026.09', root=root)

    def verified_document_assessment(self, *, effective=None, required=True, rule_id='TEST-A'):
        from app.rules.schemas import Rule
        from app.rules.evaluator import RuleAssessment
        document = next(rule for rule in load_version('2026.09') if rule.id == 'ENV-004').requiredDocuments[0].model_dump(mode='json')
        document.update({'fieldsToCompare': ['enterpriseName'], 'effectiveFrom': effective, 'required': required})
        rule = Rule.model_validate({'id': rule_id, 'version': 1, 'when': {'all': [{'field': 'x', 'equals': True}]}, 'then': {'recommend': 'consent-to-operate', 'status': 'required'}, 'explanation': 'Synthetic verified fixture, not a production rule.', 'verification': 'VERIFIED', 'jurisdiction': 'MH', 'sources': [SOURCE], 'requiredDocuments': [document]})
        return RuleAssessment(rule, 'matched')

    def test_document_comparison_fields_are_preserved(self):
        from app.services.recommendation import enrich_recommendations
        approvals, issues, _ = enrich_recommendations([self.verified_document_assessment()], {})
        self.assertEqual(approvals[0]['documents'][0]['fieldsToCompare'], ['enterpriseName'])
        self.assertTrue(approvals[0]['documents'][0]['required'])
        self.assertEqual(issues, [])

    def test_document_effective_date_is_respected(self):
        from app.services.recommendation import enrich_recommendations
        assessment = self.verified_document_assessment(effective='2027-01-01')
        approvals, issues, _ = enrich_recommendations([assessment], {})
        self.assertEqual(approvals[0]['documents'], [])
        self.assertEqual(issues[0]['fields'], ['context.evaluationDate'])
        approvals, _, _ = enrich_recommendations([assessment], {}, evaluation_date=date(2026, 9, 17))
        self.assertEqual(approvals[0]['documents'], [])
        approvals, _, _ = enrich_recommendations([assessment], {}, evaluation_date=date(2027, 1, 1))
        self.assertEqual(len(approvals[0]['documents']), 1)

    def test_grouped_document_required_flag_merges_and_rule_id_is_stable(self):
        from app.services.recommendation import enrich_recommendations
        a = self.verified_document_assessment(required=False, rule_id='TEST-A')
        b = self.verified_document_assessment(required=True, rule_id='TEST-B')
        forward = enrich_recommendations([a, b], {})
        reverse = enrich_recommendations([b, a], {})
        self.assertEqual(forward, reverse)
        self.assertEqual(forward[0][0]['ruleId'], 'TEST-A')
        self.assertTrue(forward[0][0]['documents'][0]['required'])


class DependencyTests(unittest.TestCase):
    def edge(self, prerequisite, target='consent-to-operate', external=True, verification='VERIFIED'):
        return DependencyEdge(target, DependencySpec(prerequisite=prerequisite, stage='operation', external=external, verification=verification, reason='Conditional workflow prerequisite, after applicability confirmation.', sources=[SOURCE]))

    def test_immediate_and_dependent(self):
        edge = self.edge('consent-to-establish')
        result = calculate_dependencies(['consent-to-operate'], [edge], stage='operation')
        self.assertEqual(result['dependent'], ['consent-to-operate'])
        self.assertEqual(result['missingPrerequisites'], ['consent-to-establish'])
        result = calculate_dependencies(['consent-to-operate'], [edge], stage='operation', completed=['consent-to-establish'])
        self.assertEqual(result['immediate'], ['consent-to-operate'])

    def test_parallel_preparation_only(self):
        group = ['fire-noc', 'factory-registration']
        result = calculate_dependencies(group, parallel_groups=[group])
        self.assertEqual(result['parallel'][0]['verification'], 'PROTOTYPE_ASSUMPTION')
        with self.assertRaises(ValueError):
            calculate_dependencies(group, stage='operation', parallel_groups=[group])

    def test_unverified_dependency_requires_review(self):
        result = calculate_dependencies(['consent-to-operate'], [self.edge('consent-to-establish', verification='NEEDS_REVIEW')], stage='operation')
        self.assertEqual(result['dependent'], [])
        self.assertEqual(result['needsReview'], ['consent-to-operate'])

    def test_unknown_and_cycles(self):
        with self.assertRaises(ValueError):
            calculate_dependencies(['invalid'])
        with self.assertRaises(ValueError):
            calculate_dependencies(['fire-noc'], [self.edge('invalid', target='fire-noc')])
        edges = [self.edge('fire-noc', 'factory-registration', False), self.edge('factory-registration', 'fire-noc', False)]
        with self.assertRaisesRegex(ValueError, 'cycle'):
            calculate_dependencies(['fire-noc', 'factory-registration'], edges)

    def test_order(self):
        self.assertEqual(calculate_dependencies(['fire-noc', 'factory-registration'])['order'], ['factory-registration', 'fire-noc'])
