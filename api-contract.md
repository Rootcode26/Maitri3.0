Node → Python request (all profile fields)

POST /evaluate
{
  "rulesVersion": "2026.09",
  "projectId": "a1b2c3d4-0000-4444-8888-1234567890ab",
  "project": {
    "enterpriseName": "Sahyadri Foods Pvt. Ltd.",
    "organisationType": "private-limited",
    "industry": "food",
    "cin": "U15490PN2026PTC00124",
    "pan": "AABCS1234F",
    "gstin": "27AABCS1234F1Z5",
    "udyam": "UDYAM-MH-00-0000000",

    "district": "Pune",
    "taluka": "Khed",
    "pincode": "410501",
    "industrialArea": "Chakan MIDC",
    "plotNumber": "Plot D-42",
    "plotArea": "500–2,000",
    "builtUpArea": "250–1,000",
    "landStatus": "allotted-midc",

    "primaryActivity": "Food & beverage processing",
    "projectStage": "new",
    "investment": "₹100–1,000 lakh (Small)",
    "capacity": "18 tonnes / day",
    "shifts": "Two shifts",
    "boiler": "yes",
    "boilerCapacity": "1–5",
    "boilerPressure": "10.5",
    "hazardousChemicals": "no",
    "processes": ["Manufacturing / processing", "Packaging and storage", "Boiler operation"],

    "fssaiCategory": "State licence",
    "coldStorage": "50–500",
    "wetProcessing": null,
    "loomsSpindles": null,
    "furnaceType": null,
    "furnaceCapacity": null,

    "electricity": "100–500",
    "dgSet": "Up to 125",
    "waterUse": "10–50",
    "waterSource": "MIDC supply",
    "wastewater": "Common treatment facility",
    "hazardousWaste": "no",

    "permanent": "20–49",
    "contract": "1–19",
    "womenNight": "no",
    "accommodation": "Not provided"
  }
}

Python → Node response (all approvals + documents, all fields)

{
  "rulesVersion": "2026.09",
  "projectId": "a1b2c3d4-0000-4444-8888-1234567890ab",
  "evaluatedAt": "2026-09-17T10:15:00Z",
  "readinessScore": 0.0,
  "blockingIssues": [],
  "approvals": [
    {
      "key": "food-licence",
      "title": "Food-related licence",
      "status": "required",
      "reason": "Food & beverage processing falls under the FSSAI Act.",
      "ruleId": "FSSAI-STATE-001",
      "departmentKey": "fssai",
      "processingDays": 30,
      "documents": [
        {
          "key": "factory-plan",
          "name": "Factory plan",
          "description": "A complete plan of the proposed food-processing premises.",
          "formats": ["PDF"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Plot boundary, room names and dimensions",
            "Processing, packaging and storage areas",
            "Water points, drainage and entry / exit routes"
          ],
          "quality": [
            "Upload one legible PDF with all drawing sheets in order.",
            "Do not use password-protected files."
          ]
        },
        {
          "key": "identity-proof",
          "name": "Identity proof",
          "description": "Government-issued identity proof of the authorised signatory.",
          "formats": ["PDF", "JPG", "PNG"],
          "maxSizeMb": 2,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Full name and photograph",
            "Document number clearly visible",
            "Not expired on the date of upload"
          ],
          "quality": [
            "Upload a clear colour scan with all four corners visible.",
            "Avoid glare and shadows."
          ]
        },
        {
          "key": "water-report",
          "name": "Water report",
          "description": "A laboratory water-quality test report for the site supply.",
          "formats": ["PDF"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Sampling date and source location",
            "Tested parameters and permissible limits",
            "Accredited laboratory name and signature"
          ],
          "quality": [
            "Upload the complete signed report as a single PDF.",
            "Ensure result tables are legible."
          ]
        }
      ]
    },
    {
      "key": "factory-registration",
      "title": "Factory registration",
      "status": "recommended",
      "reason": "Manufacturing unit with power and 20–49 workers under the Factories Act.",
      "ruleId": "DISH-FAC-010",
      "departmentKey": "dish",
      "processingDays": 45,
      "documents": [
        {
          "key": "floor-plan",
          "name": "Floor plan",
          "description": "A floor plan of the factory building.",
          "formats": ["PDF"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Room names, dimensions and machine positions",
            "Aisles, exits and emergency routes",
            "Utility and storage locations"
          ],
          "quality": ["Include a north arrow and a drawing scale."]
        },
        {
          "key": "machinery-list",
          "name": "Machinery list",
          "description": "An itemised list of installed plant and machinery.",
          "formats": ["PDF", "XLSX"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Machine name, make and model",
            "Rated capacity and power (kW)",
            "Quantity and year of installation"
          ],
          "quality": ["Group machines by process stage."]
        },
        {
          "key": "worker-details",
          "name": "Worker details",
          "description": "A summary of the workforce to be employed.",
          "formats": ["PDF", "XLSX"],
          "maxSizeMb": 2,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Total, permanent and contract head-count",
            "Shift pattern and women employed",
            "Roles and safety-training status"
          ],
          "quality": ["Do not include personal identity numbers."]
        }
      ]
    },
    {
      "key": "fire-noc",
      "title": "Fire safety NOC",
      "status": "recommended",
      "reason": "Built-up area and occupancy require a fire clearance.",
      "ruleId": "FIRE-NOC-004",
      "departmentKey": "fire-emergency-services",
      "processingDays": 21,
      "documents": [
        {
          "key": "fire-layout",
          "name": "Fire layout",
          "description": "A fire-safety layout of the premises.",
          "formats": ["PDF"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Fire exits, assembly points and travel distances",
            "Extinguisher, hydrant and alarm locations",
            "Fire tank and pump-room details"
          ],
          "quality": ["Mark all equipment with standard symbols."]
        },
        {
          "key": "evacuation-plan",
          "name": "Evacuation plan",
          "description": "An emergency evacuation plan for the site.",
          "formats": ["PDF"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Escape routes for each area",
            "Assembly points and head-count procedure",
            "Emergency contacts and responsibilities"
          ],
          "quality": ["Keep floor references consistent with the fire layout."]
        },
        {
          "key": "site-photograph",
          "name": "Site photograph",
          "description": "Recent photographs of the site or building.",
          "formats": ["JPG", "PNG", "PDF"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": false,
          "mustInclude": [
            "Building frontage and entry",
            "Surrounding access roads",
            "A visible date or landmark reference"
          ],
          "quality": ["Upload clear, well-lit colour images."]
        }
      ]
    },
    {
      "key": "consent-to-operate",
      "title": "Consent to operate",
      "status": "recommended",
      "reason": "Effluent and waste generation attract MPCB consent.",
      "ruleId": "MPCB-CTO-021",
      "departmentKey": "mpcb",
      "processingDays": 60,
      "documents": [
        {
          "key": "water-balance",
          "name": "Water balance",
          "description": "A water balance statement for the unit.",
          "formats": ["PDF"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Fresh-water intake by source",
            "Process, domestic and cooling use",
            "Recycled and discharged quantities"
          ],
          "quality": ["Figures must reconcile with the declared water use."]
        },
        {
          "key": "waste-declaration",
          "name": "Waste declaration",
          "description": "A declaration of waste generated and how it is handled.",
          "formats": ["PDF"],
          "maxSizeMb": 2,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Solid, liquid and hazardous waste types",
            "Estimated quantity per category",
            "Storage, treatment and disposal route"
          ],
          "quality": ["List authorised handlers where applicable."]
        },
        {
          "key": "process-note",
          "name": "Process note",
          "description": "A description of the manufacturing process.",
          "formats": ["PDF"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Process flow from input to output",
            "Emission, effluent and by-product points",
            "Key equipment at each stage"
          ],
          "quality": ["Include a flow diagram."]
        }
      ]
    },
    {
      "key": "boiler-registration",
      "title": "Boiler registration",
      "status": "recommended",
      "reason": "A boiler of 1–5 TPH must be registered under the Boilers Act.",
      "ruleId": "BOILER-REG-002",
      "departmentKey": "steam-boilers",
      "processingDays": 30,
      "documents": [
        {
          "key": "boiler-drawing",
          "name": "Boiler drawing",
          "description": "An approved drawing of the boiler or pressure vessel.",
          "formats": ["PDF"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "General arrangement and mounting details",
            "Design pressure, capacity and dimensions",
            "Safety fittings and mountings"
          ],
          "quality": ["Include the manufacturer and drawing number."]
        },
        {
          "key": "test-certificate",
          "name": "Test certificate",
          "description": "A hydraulic or manufacturer test certificate.",
          "formats": ["PDF"],
          "maxSizeMb": 2,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Test date, pressure and result",
            "Boiler / vessel identification",
            "Inspector or manufacturer signature"
          ],
          "quality": ["Ensure stamps and seals are legible."]
        },
        {
          "key": "feed-water-report",
          "name": "Feed-water report",
          "description": "A feed-water quality report for the boiler.",
          "formats": ["PDF"],
          "maxSizeMb": 5,
          "filesRequired": 1,
          "required": true,
          "mustInclude": [
            "Sampling date and source",
            "Tested parameters and permissible limits",
            "Accredited laboratory details"
          ],
          "quality": ["Upload the complete signed report as one PDF."]
        }
      ]
    }
  ]
}
