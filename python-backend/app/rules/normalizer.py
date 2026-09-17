from math import isfinite
from typing import Any


def normalize_project(project: dict[str, Any]) -> dict[str, Any]:
    """
    Convert the finalized Node -> Python project payload into the
    structured field names/values expected by the rules engine.

    This is an adapter only. It does not evaluate rules.

    Unknown process labels raise ValueError instead of disappearing. Explicit
    null processes remain unknown; invalid/non-finite pressure becomes None.
    State is not part of this flat contract and must be supplied outside it.
    """

    industry = project.get("industry")

    industry_map = {
        "food": "food",
        "textile": "textile",
        "steel": "steel",
    }

    primary_activity_map = {
        "Food & beverage processing": "food_beverage_processing",
        "Dairy / cold storage": "dairy_cold_storage",
        "Dairy & cold storage": "dairy_cold_storage",
        "Bakery / confectionery": "bakery_confectionery",
        "Bakery & confectionery": "bakery_confectionery",
        "Meat / seafood processing": "meat_seafood_processing",
        "Meat & seafood processing": "meat_seafood_processing",
        "Spinning": "spinning",
        "Weaving": "weaving",
        "Knitting": "knitting",
        "Dyeing / processing": "dyeing_processing",
        "Dyeing & processing": "dyeing_processing",
        "Garment manufacturing": "garment_manufacturing",
        "Steel / metal fabrication": "steel_metal_fabrication",
        "Steel & metal fabrication": "steel_metal_fabrication",
        "Foundry / casting": "foundry_casting",
        "Rolling mill": "rolling_mill",
        "Structural fabrication": "structural_fabrication",
    }

    project_stage_map = {
        "new": "new_unit",
        "expansion": "expansion",
        "modernisation": "modernisation",
    }

    organisation_type_map = {
        "private-limited": "private_limited",
        "public-limited": "public_limited",
        "partnership": "partnership",
        "proprietorship": "proprietorship",
        "llp": "llp",
    }

    land_status_map = {
        "owned": "owned",
        "leased": "leased",
        "allotted-midc": "midc_allotted",
        "under-acquisition": "under_acquisition",
    }

    plot_area_map = {
        "Up to 500": "up_to_500",
        "500–2,000": "from_500_to_2000",
        "2,000–5,000": "from_2000_to_5000",
        "5,000–10,000": "from_5000_to_10000",
        "Above 10,000": "above_10000",
    }

    built_up_area_map = {
        "Up to 250": "up_to_250",
        "250–1,000": "from_250_to_1000",
        "1,000–5,000": "from_1000_to_5000",
        "Above 5,000": "above_5000",
    }

    investment_map = {
        "Up to ₹100 lakh": "up_to_100_lakh",
        "Up to ₹100 lakh (Micro)": "up_to_100_lakh",
        "₹100–1,000 lakh (Small)": "from_100_to_1000_lakh",
        "₹1,000–5,000 lakh": "from_1000_to_5000_lakh",
        "₹1,000–5,000 lakh (Medium)": "from_1000_to_5000_lakh",
        "Above ₹5,000 lakh": "above_5000_lakh",
        "Above ₹5,000 lakh (Large)": "above_5000_lakh",
    }

    electricity_map = {
        "Up to 50": "up_to_50",
        "50–100": "from_50_to_100",
        "100–500": "from_100_to_500",
        "500–1,000": "from_500_to_1000",
        "Above 1,000": "above_1000",
    }

    workforce_map = {
        "Less than 10": "less_than_10",
        "10–19": "from_10_to_19",
        "20–49": "from_20_to_49",
        "50–99": "from_50_to_99",
        "100–499": "from_100_to_499",
        "500 or more": "500_or_more",
    }

    contract_worker_map = {
        "None": "none",
        "1–19": "from_1_to_19",
        "20–49": "from_20_to_49",
        "50 or more": "50_or_more",
    }

    water_use_map = {
        "Up to 10": "up_to_10",
        "10–50": "from_10_to_50",
        "50–100": "from_50_to_100",
        "100–500": "from_100_to_500",
        "Above 500": "above_500",
    }

    dg_set_map = {
        "None": "none",
        "Up to 125": "up_to_125",
        "125–500": "from_125_to_500",
        "500–1,000": "from_500_to_1000",
        "Above 1,000": "above_1000",
    }

    wastewater_map = {
        "Common treatment facility": "common_treatment_facility",
        "Onsite treatment plant": "onsite_treatment_plant",
        "On-site treatment plant": "onsite_treatment_plant",
        "Zero liquid discharge": "zero_liquid_discharge",
        "No discharge (zero liquid)": "zero_liquid_discharge",
        "Municipal sewer": "municipal_sewer",
    }

    water_source_map = {
        "MIDC supply": "midc_supply",
        "Municipal supply": "municipal_supply",
        "Borewell": "borewell",
        "Surface water": "surface_water",
        "Tanker": "tanker",
    }

    boiler_capacity_map = {
        "Up to 1": "up_to_1",
        "1–5": "from_1_to_5",
        "5–10": "from_5_to_10",
        "Above 10": "above_10",
    }

    processes_map = {
        "Manufacturing / processing": "manufacturing_processing",
        "Packaging and storage": "packaging_storage",
        "Boiler operation": "boiler_operation",
        "Onsite effluent treatment": "onsite_effluent_treatment",
        "On-site effluent treatment": "onsite_effluent_treatment",
    }

    normalized: dict[str, Any] = {
        "businessProfile": {
            "legalName": project.get("enterpriseName"),
            "organisationType": organisation_type_map.get(
                project.get("organisationType")
            ),
            "industrySector": industry_map.get(industry),
            "registrationNumber": project.get("cin"),
            "pan": project.get("pan"),
            "gstin": project.get("gstin"),
            "udyamRegistrationNumber": project.get("udyam"),
        },
        "location": {
            "stateCode": None,
            "district": project.get("district"),
            "taluka": project.get("taluka"),
            "postalCode": project.get("pincode"),
            "industrialArea": project.get("industrialArea"),
            "plotNumber": project.get("plotNumber"),
            "plotAreaBand": plot_area_map.get(
                project.get("plotArea")
            ),
            "builtUpAreaBand": built_up_area_map.get(
                project.get("builtUpArea")
            ),
            "landStatus": land_status_map.get(
                project.get("landStatus")
            ),
        },
        "operations": {
            "primaryActivity": primary_activity_map.get(
                project.get("primaryActivity")
            ),
            "projectStage": project_stage_map.get(
                project.get("projectStage")
            ),
            "investmentBand": investment_map.get(
                project.get("investment")
            ),
            "installedCapacity": {
                "rawText": project.get("capacity"),
            },
            "operatingShifts": _parse_shifts(
                project.get("shifts")
            ),
            "hasBoilerOrPressureVessel": _parse_bool(
                project.get("boiler")
            ),
            "boilerCapacityBand": boiler_capacity_map.get(
                project.get("boilerCapacity")
            ),
            "boilerWorkingPressureKgCm2": _parse_number(
                project.get("boilerPressure")
            ),
            "handlesHazardousChemicals": _parse_bool(
                project.get("hazardousChemicals")
            ),
            "processesUsed": _normalize_processes(project.get("processes", []), processes_map),
        },
        "utilities": {
            "electricityDemandBand": electricity_map.get(
                project.get("electricity")
            ),
            "dgSetCapacityBand": dg_set_map.get(
                project.get("dgSet")
            ),
            "dailyWaterUseBand": water_use_map.get(
                project.get("waterUse")
            ),
            "waterSource": water_source_map.get(
                project.get("waterSource")
            ),
            "wastewaterDischarge": wastewater_map.get(
                project.get("wastewater")
            ),
            "generatesHazardousWaste": _parse_bool(
                project.get("hazardousWaste")
            ),
        },
        "workforce": {
            "permanentEmployeeBand": workforce_map.get(
                project.get("permanent")
            ),
            "contractWorkerBand": contract_worker_map.get(
                project.get("contract")
            ),
            "womenEmployedInNightShift": _parse_bool(
                project.get("womenNight")
            ),
            "workerAccommodation": _parse_accommodation(
                project.get("accommodation")
            ),
        },
    }

    normalized["sectorDetails"] = _build_sector_details(
        project,
        industry,
    )

    return normalized


def _parse_bool(value: Any) -> bool | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return value

    value_map = {
        "yes": True,
        "no": False,
        "true": True,
        "false": False,
    }

    return value_map.get(
        str(value).strip().lower()
    )


def _parse_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None

    try:
        number = float(value)
        return number if isfinite(number) and number >= 0 else None
    except (TypeError, ValueError, OverflowError):
        return None


def _normalize_processes(value: Any, mapping: dict[str, str]) -> list[str] | None:
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError("project.processes must be a list or null")
    result = []
    for index, label in enumerate(value):
        if not isinstance(label, str) or label not in mapping:
            raise ValueError(f"project.processes[{index}] contains an unsupported process value")
        result.append(mapping[label])
    return result


def _parse_shifts(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None

    shift_map = {
        "One shift": 1,
        "Two shifts": 2,
        "Three shifts": 3,
    }

    if isinstance(value, str) and value in shift_map:
        return shift_map[value]

    try:
        number = float(value)
        return int(number) if isfinite(number) and number in (1, 2, 3) else None
    except (TypeError, ValueError, OverflowError):
        return None


def _parse_accommodation(value: Any) -> str | None:
    accommodation_map = {
        "Not provided": "not_provided",
        "Onsite quarters": "onsite_quarters",
        "On-site quarters": "onsite_quarters",
        "Nearby housing": "nearby_housing",
    }

    return accommodation_map.get(value)


def _build_sector_details(
    project: dict[str, Any],
    industry: Any,
) -> dict[str, Any] | None:

    if industry == "food":
        return {
            "sector": "food",
            "fssaiLicenceCategory": _normalize_fssai_category(
                project.get("fssaiCategory")
            ),
            "coldStorageCapacityBand": _normalize_cold_storage(
                project.get("coldStorage")
            ),
        }

    if industry == "textile":
        return {
            "sector": "textile",
            "involvesDyeingOrBleaching": _parse_bool(
                project.get("wetProcessing")
            ),
            "loomsOrSpindlesBand": {
                "Up to 50": "up_to_50",
                "50–200": "from_50_to_200",
                "200–500": "from_200_to_500",
                "Above 500": "above_500",
            }.get(project.get("loomsSpindles")),
        }

    if industry == "steel":
        return {
            "sector": "steel",
            "furnaceType": {
                "Induction furnace": "induction",
                "Electric arc furnace": "electric_arc",
                "Cupola": "cupola",
                "None": "none",
            }.get(project.get("furnaceType")),
            "furnaceCapacityBand": {
                "Up to 5": "up_to_5",
                "5–20": "from_5_to_20",
                "20–50": "from_20_to_50",
                "Above 50": "above_50",
            }.get(project.get("furnaceCapacity")),
        }

    return None


def _normalize_fssai_category(value: Any) -> str | None:
    mapping = {
        "Central licence": "central_licence",
        "State licence": "state_licence",
        "Basic registration": "basic_registration",
    }

    return mapping.get(value)


def _normalize_cold_storage(value: Any) -> str | None:
    mapping = {
        "None": "none",
        "Up to 50": "up_to_50",
        "50–500": "from_50_to_500",
        "500–2,000": "from_500_to_2000",
        "Above 2,000": "above_2000",
    }

    return mapping.get(value)
