export const organisationTypes = [
  'private-limited',
  'public-limited',
  'partnership',
  'proprietorship',
  'llp',
] as const;

export const projectStages = ['new', 'expansion', 'modernisation'] as const;

export const landStatuses = ['owned', 'leased', 'allotted-midc', 'under-acquisition'] as const;

export const yesNo = ['yes', 'no'] as const;

export const primaryActivities = [
  'Food & beverage processing',
  'Dairy & cold storage',
  'Bakery & confectionery',
  'Meat & seafood processing',
  'Spinning',
  'Weaving',
  'Knitting',
  'Dyeing & processing',
  'Garment manufacturing',
  'Steel & metal fabrication',
  'Foundry / casting',
  'Rolling mill',
  'Structural fabrication',
] as const;

export const plotAreaBands = [
  'Up to 500',
  '500–2,000',
  '2,000–5,000',
  '5,000–10,000',
  'Above 10,000',
] as const;

export const builtUpAreaBands = ['Up to 250', '250–1,000', '1,000–5,000', 'Above 5,000'] as const;

export const investmentBands = [
  'Up to ₹100 lakh (Micro)',
  '₹100–1,000 lakh (Small)',
  '₹1,000–5,000 lakh (Medium)',
  'Above ₹5,000 lakh (Large)',
] as const;

export const shiftBands = ['One shift', 'Two shifts', 'Three shifts'] as const;

export const boilerCapacityBands = ['Up to 1', '1–5', '5–10', 'Above 10'] as const;

export const processOptions = [
  'Manufacturing / processing',
  'Packaging and storage',
  'Boiler operation',
  'On-site effluent treatment',
] as const;

export const fssaiCategories = ['Central licence', 'State licence', 'Basic registration'] as const;

export const coldStorageBands = ['None', 'Up to 50', '50–500', '500–2,000', 'Above 2,000'] as const;

export const loomsSpindlesBands = ['Up to 50', '50–200', '200–500', 'Above 500'] as const;

export const furnaceTypes = [
  'Induction furnace',
  'Electric arc furnace',
  'Cupola',
  'None',
] as const;

export const furnaceCapacityBands = ['Up to 5', '5–20', '20–50', 'Above 50'] as const;

export const electricityBands = [
  'Up to 50',
  '50–100',
  '100–500',
  '500–1,000',
  'Above 1,000',
] as const;

export const dgSetBands = ['None', 'Up to 125', '125–500', '500–1,000', 'Above 1,000'] as const;

export const waterUseBands = ['Up to 10', '10–50', '50–100', '100–500', 'Above 500'] as const;

export const waterSources = [
  'MIDC supply',
  'Municipal supply',
  'Borewell',
  'Surface water',
  'Tanker',
] as const;

export const wastewaterOptions = [
  'Common treatment facility',
  'On-site treatment plant',
  'No discharge (zero liquid)',
  'Municipal sewer',
] as const;

export const permanentBands = [
  'Less than 10',
  '10–19',
  '20–49',
  '50–99',
  '100–499',
  '500 or more',
] as const;

export const contractBands = ['None', '1–19', '20–49', '50 or more'] as const;

export const accommodationOptions = ['Not provided', 'On-site quarters', 'Nearby housing'] as const;

export type OrganisationType = (typeof organisationTypes)[number];
export type ProjectStage = (typeof projectStages)[number];
export type LandStatus = (typeof landStatuses)[number];
export type YesNo = (typeof yesNo)[number];
