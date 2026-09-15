export const industryLabels = { food: "Food", textile: "Textile", steel: "Steel" } as const;

export const inspectorDepartments = {
  food: [
    { value: "fda-maharashtra", label: "Food and Drug Administration, Maharashtra" },
    { value: "fssai", label: "Food Safety and Standards Authority of India (FSSAI)" },
    { value: "mpcb", label: "Maharashtra Pollution Control Board (MPCB)" },
    { value: "dish", label: "Directorate of Industrial Safety and Health (DISH)" },
    { value: "fire-emergency-services", label: "Maharashtra Fire and Emergency Services" },
    { value: "midc-planning", label: "MIDC Planning and Building Permissions" },
    { value: "msedcl", label: "Maharashtra State Electricity Distribution (MSEDCL)" },
  ],
  textile: [
    { value: "textiles-directorate", label: "Directorate of Textiles, Maharashtra" },
    { value: "mpcb", label: "Maharashtra Pollution Control Board (MPCB)" },
    { value: "dish", label: "Directorate of Industrial Safety and Health (DISH)" },
    { value: "fire-emergency-services", label: "Maharashtra Fire and Emergency Services" },
    { value: "midc-planning", label: "MIDC Planning and Building Permissions" },
    { value: "msedcl", label: "Maharashtra State Electricity Distribution (MSEDCL)" },
    { value: "steam-boilers", label: "Directorate of Steam Boilers, Maharashtra" },
  ],
  steel: [
    { value: "mpcb", label: "Maharashtra Pollution Control Board (MPCB)" },
    { value: "dish", label: "Directorate of Industrial Safety and Health (DISH)" },
    { value: "fire-emergency-services", label: "Maharashtra Fire and Emergency Services" },
    { value: "midc-planning", label: "MIDC Planning and Building Permissions" },
    { value: "msedcl", label: "Maharashtra State Electricity Distribution (MSEDCL)" },
    { value: "steam-boilers", label: "Directorate of Steam Boilers, Maharashtra" },
    { value: "seiaa", label: "Environment Department / SEIAA Maharashtra" },
  ],
} as const;

export const allInspectorDepartments = Array.from(
  new Map(Object.values(inspectorDepartments).flat().map((department) => [department.value, department])).values(),
);
