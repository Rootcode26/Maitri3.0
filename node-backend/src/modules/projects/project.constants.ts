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

export type OrganisationType = (typeof organisationTypes)[number];
export type ProjectStage = (typeof projectStages)[number];
export type LandStatus = (typeof landStatuses)[number];
export type YesNo = (typeof yesNo)[number];
