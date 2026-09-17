"""Flat contract characterization; no regulatory applicability assertions."""
import copy
import json
from pathlib import Path
import unittest

from app.rules.normalizer import normalize_project


class NormalizerTests(unittest.TestCase):
    def mapping(self, field, section, target, pairs, **extra):
        for label, expected in pairs:
            with self.subTest(field=field, label=label):
                self.assertEqual(normalize_project({field: label, **extra})[section][target], expected)

    def test_industry(self):
        self.mapping('industry', 'businessProfile', 'industrySector', [(x, x) for x in ['food', 'textile', 'steel']])

    def test_primary_activity(self):
        self.mapping('primaryActivity', 'operations', 'primaryActivity', [
            ('Food & beverage processing', 'food_beverage_processing'),
            ('Dairy & cold storage', 'dairy_cold_storage'),
            ('Bakery & confectionery', 'bakery_confectionery'),
            ('Meat & seafood processing', 'meat_seafood_processing'),
            ('Spinning', 'spinning'), ('Weaving', 'weaving'), ('Knitting', 'knitting'),
            ('Dyeing & processing', 'dyeing_processing'),
            ('Garment manufacturing', 'garment_manufacturing'),
            ('Steel & metal fabrication', 'steel_metal_fabrication'),
            ('Foundry / casting', 'foundry_casting'), ('Rolling mill', 'rolling_mill'),
            ('Structural fabrication', 'structural_fabrication'),
        ])

    def test_project_stage(self):
        self.mapping('projectStage', 'operations', 'projectStage', [('new', 'new_unit'), ('expansion', 'expansion'), ('modernisation', 'modernisation')])

    def test_organisation(self):
        self.mapping('organisationType', 'businessProfile', 'organisationType', [('private-limited', 'private_limited'), ('public-limited', 'public_limited'), ('partnership', 'partnership'), ('proprietorship', 'proprietorship'), ('llp', 'llp')])

    def test_plot_area(self):
        self.mapping('plotArea', 'location', 'plotAreaBand', [('Up to 500', 'up_to_500'), ('500–2,000', 'from_500_to_2000'), ('2,000–5,000', 'from_2000_to_5000'), ('5,000–10,000', 'from_5000_to_10000'), ('Above 10,000', 'above_10000')])

    def test_built_up_area(self):
        self.mapping('builtUpArea', 'location', 'builtUpAreaBand', [('Up to 250', 'up_to_250'), ('250–1,000', 'from_250_to_1000'), ('1,000–5,000', 'from_1000_to_5000'), ('Above 5,000', 'above_5000')])

    def test_investment(self):
        self.mapping('investment', 'operations', 'investmentBand', [('Up to ₹100 lakh (Micro)', 'up_to_100_lakh'), ('₹100–1,000 lakh (Small)', 'from_100_to_1000_lakh'), ('₹1,000–5,000 lakh (Medium)', 'from_1000_to_5000_lakh'), ('Above ₹5,000 lakh (Large)', 'above_5000_lakh')])

    def test_electricity(self):
        self.mapping('electricity', 'utilities', 'electricityDemandBand', [('Up to 50', 'up_to_50'), ('50–100', 'from_50_to_100'), ('100–500', 'from_100_to_500'), ('500–1,000', 'from_500_to_1000'), ('Above 1,000', 'above_1000')])

    def test_permanent_workers(self):
        self.mapping('permanent', 'workforce', 'permanentEmployeeBand', [('Less than 10', 'less_than_10'), ('10–19', 'from_10_to_19'), ('20–49', 'from_20_to_49'), ('50–99', 'from_50_to_99'), ('100–499', 'from_100_to_499'), ('500 or more', '500_or_more')])

    def test_contract_workers(self):
        self.mapping('contract', 'workforce', 'contractWorkerBand', [('None', 'none'), ('1–19', 'from_1_to_19'), ('20–49', 'from_20_to_49'), ('50 or more', '50_or_more')])

    def test_water_use(self):
        self.mapping('waterUse', 'utilities', 'dailyWaterUseBand', [('Up to 10', 'up_to_10'), ('10–50', 'from_10_to_50'), ('50–100', 'from_50_to_100'), ('100–500', 'from_100_to_500'), ('Above 500', 'above_500')])

    def test_dg_set(self):
        self.mapping('dgSet', 'utilities', 'dgSetCapacityBand', [('None', 'none'), ('Up to 125', 'up_to_125'), ('125–500', 'from_125_to_500'), ('500–1,000', 'from_500_to_1000'), ('Above 1,000', 'above_1000')])

    def test_wastewater(self):
        self.mapping('wastewater', 'utilities', 'wastewaterDischarge', [('Common treatment facility', 'common_treatment_facility'), ('On-site treatment plant', 'onsite_treatment_plant'), ('No discharge (zero liquid)', 'zero_liquid_discharge'), ('Municipal sewer', 'municipal_sewer')])

    def test_water_source(self):
        self.mapping('waterSource', 'utilities', 'waterSource', [('MIDC supply', 'midc_supply'), ('Municipal supply', 'municipal_supply'), ('Borewell', 'borewell'), ('Surface water', 'surface_water'), ('Tanker', 'tanker')])

    def test_boiler_fields(self):
        self.mapping('boilerCapacity', 'operations', 'boilerCapacityBand', [('Up to 1', 'up_to_1'), ('1–5', 'from_1_to_5'), ('5–10', 'from_5_to_10'), ('Above 10', 'above_10')])
        self.assertEqual(normalize_project({'boilerPressure': '10.5'})['operations']['boilerWorkingPressureKgCm2'], 10.5)
        self.assertIsNone(normalize_project({'boilerPressure': None})['operations']['boilerWorkingPressureKgCm2'])

    def test_processes(self):
        labels = ['Manufacturing / processing', 'Packaging and storage', 'Boiler operation', 'On-site effluent treatment']
        self.assertEqual(normalize_project({'processes': labels})['operations']['processesUsed'], ['manufacturing_processing', 'packaging_storage', 'boiler_operation', 'onsite_effluent_treatment'])
        self.assertEqual(normalize_project({'processes': []})['operations']['processesUsed'], [])

    def test_boolean_fields(self):
        fields = [('boiler', 'operations', 'hasBoilerOrPressureVessel'), ('hazardousChemicals', 'operations', 'handlesHazardousChemicals'), ('hazardousWaste', 'utilities', 'generatesHazardousWaste'), ('womenNight', 'workforce', 'womenEmployedInNightShift'), ('wetProcessing', 'sectorDetails', 'involvesDyeingOrBleaching')]
        for field, section, target in fields:
            self.mapping(field, section, target, [('yes', True), ('no', False), (None, None)], industry='textile')

    def test_shifts(self):
        self.mapping('shifts', 'operations', 'operatingShifts', [('One shift', 1), ('Two shifts', 2), ('Three shifts', 3), (None, None)])

    def test_accommodation(self):
        self.mapping('accommodation', 'workforce', 'workerAccommodation', [('Not provided', 'not_provided'), ('On-site quarters', 'onsite_quarters'), ('Nearby housing', 'nearby_housing')])

    def test_food_sector(self):
        self.mapping('fssaiCategory', 'sectorDetails', 'fssaiLicenceCategory', [('Central licence', 'central_licence'), ('State licence', 'state_licence'), ('Basic registration', 'basic_registration')], industry='food')
        self.mapping('coldStorage', 'sectorDetails', 'coldStorageCapacityBand', [('None', 'none'), ('Up to 50', 'up_to_50'), ('50–500', 'from_50_to_500'), ('500–2,000', 'from_500_to_2000'), ('Above 2,000', 'above_2000')], industry='food')

    def test_textile_sector(self):
        self.mapping('loomsSpindles', 'sectorDetails', 'loomsOrSpindlesBand', [('Up to 50', 'up_to_50'), ('50–200', 'from_50_to_200'), ('200–500', 'from_200_to_500'), ('Above 500', 'above_500')], industry='textile')
        self.assertEqual(normalize_project({'industry': 'textile', 'wetProcessing': 'yes'})['sectorDetails']['sector'], 'textile')

    def test_steel_sector(self):
        self.mapping('furnaceType', 'sectorDetails', 'furnaceType', [('Induction furnace', 'induction'), ('Electric arc furnace', 'electric_arc'), ('Cupola', 'cupola'), ('None', 'none')], industry='steel')
        self.mapping('furnaceCapacity', 'sectorDetails', 'furnaceCapacityBand', [('Up to 5', 'up_to_5'), ('5–20', 'from_5_to_20'), ('20–50', 'from_20_to_50'), ('Above 50', 'above_50')], industry='steel')

    def test_null_processes(self):
        self.assertIsNone(normalize_project({'processes': None})['operations']['processesUsed'])
        self.assertEqual(normalize_project({})['operations']['processesUsed'], [])

    def test_unknown_processes_rejected(self):
        for processes in [['Unknown'], ['Boiler operation', 'Unknown'], [None], [{}], 'Boiler operation', 5]:
            with self.subTest(processes=processes), self.assertRaisesRegex(ValueError, 'processes'):
                normalize_project({'processes': processes})
        with self.assertRaisesRegex(ValueError, r'^project\.processes\[1\] contains an unsupported process value$'):
            normalize_project({'processes': ['Boiler operation', 'Unknown']})
        with self.assertRaisesRegex(ValueError, r'^project\.processes must be a list or null$'):
            normalize_project({'processes': 'Boiler operation'})

    def test_unknown_enums_remain_unknown(self):
        for field, section, target in [
            ('industry', 'businessProfile', 'industrySector'),
            ('primaryActivity', 'operations', 'primaryActivity'),
            ('investment', 'operations', 'investmentBand'),
            ('wastewater', 'utilities', 'wastewaterDischarge'),
            ('accommodation', 'workforce', 'workerAccommodation'),
        ]:
            self.mapping(field, section, target, [('Unknown', None), (None, None)])
        for industry, field, target in [('textile', 'loomsSpindles', 'loomsOrSpindlesBand'), ('steel', 'furnaceType', 'furnaceType'), ('steel', 'furnaceCapacity', 'furnaceCapacityBand')]:
            self.mapping(field, 'sectorDetails', target, [('Unknown', None), (None, None)], industry=industry)

    def test_invalid_nonfinite_numbers(self):
        for value in ['bad', '', 'NaN', 'inf', '-Infinity', '1e9999', float('nan'), float('inf'), -1, True, {}, [], 10**1000]:
            with self.subTest(value=str(value)[:30]):
                self.assertIsNone(normalize_project({'boilerPressure': value})['operations']['boilerWorkingPressureKgCm2'])
        for value in ['0', '4.5', 4.5]:
            self.assertEqual(normalize_project({'boilerPressure': value})['operations']['boilerWorkingPressureKgCm2'], float(value))
        for value in [float('inf'), float('-inf'), float('nan'), 'NaN', 'inf', 'invalid', True, False, 0, -1, 4, 1.5, {}, []]:
            with self.subTest(shifts=value):
                self.assertIsNone(normalize_project({'shifts': value})['operations']['operatingShifts'])

    def test_state_not_inferred(self):
        self.assertIsNone(normalize_project({'district': 'Pune', 'pincode': '410501'})['location']['stateCode'])
        self.assertIsNone(normalize_project({'stateCode': 'MH'})['location']['stateCode'])

    def test_existing_legacy_labels_preserved(self):
        self.mapping('primaryActivity', 'operations', 'primaryActivity', [('Dairy / cold storage', 'dairy_cold_storage'), ('Bakery / confectionery', 'bakery_confectionery'), ('Meat / seafood processing', 'meat_seafood_processing'), ('Dyeing / processing', 'dyeing_processing'), ('Steel / metal fabrication', 'steel_metal_fabrication')])
        self.assertEqual(normalize_project({'processes': ['Onsite effluent treatment']})['operations']['processesUsed'], ['onsite_effluent_treatment'])
        self.mapping('investment', 'operations', 'investmentBand', [('Up to ₹100 lakh', 'up_to_100_lakh'), ('₹1,000–5,000 lakh', 'from_1000_to_5000_lakh'), ('Above ₹5,000 lakh', 'above_5000_lakh')])
        self.mapping('wastewater', 'utilities', 'wastewaterDischarge', [('Onsite treatment plant', 'onsite_treatment_plant'), ('Zero liquid discharge', 'zero_liquid_discharge')])
        self.mapping('accommodation', 'workforce', 'workerAccommodation', [('Onsite quarters', 'onsite_quarters')])

    def test_finalized_markdown_request(self):
        root = Path(__file__).resolve().parents[4]
        text = (root / 'api-contract.md').read_text(encoding='utf-8')
        request, _ = json.JSONDecoder().raw_decode(text[text.index('{'):])
        project = request['project']
        before = copy.deepcopy(project)
        result = normalize_project(project)
        self.assertEqual(project, before)
        self.assertEqual(result['businessProfile']['legalName'], project['enterpriseName'])
        self.assertEqual(result['operations']['projectStage'], 'new_unit')
        self.assertEqual(result['location']['plotAreaBand'], 'from_500_to_2000')
        self.assertEqual(result['operations']['boilerWorkingPressureKgCm2'], 10.5)
        self.assertEqual(result['workforce']['contractWorkerBand'], 'from_1_to_19')
        self.assertEqual(result['sectorDetails']['fssaiLicenceCategory'], 'state_licence')
        self.assertNotIn('rulesVersion', result)
        self.assertNotIn('projectId', result)


if __name__ == '__main__':
    unittest.main()
