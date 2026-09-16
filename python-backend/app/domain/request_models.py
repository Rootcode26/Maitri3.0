"""Version 2 request contract. Completeness and risk are separate assessments."""
from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

OrganisationType = Literal["private_limited", "public_limited", "partnership", "proprietorship", "llp"]
IndustrySector = Literal["food", "textile", "steel"]
PlotAreaBand = Literal["up_to_500", "from_500_to_2000", "from_2000_to_5000", "from_5000_to_10000", "above_10000"]
BuiltUpAreaBand = Literal["up_to_250", "from_250_to_1000", "from_1000_to_5000", "above_5000"]
InvestmentBand = Literal["up_to_100_lakh", "from_100_to_1000_lakh", "from_1000_to_5000_lakh", "above_5000_lakh"]
PrimaryActivity = Literal[
    "food_beverage_processing", "dairy_cold_storage", "bakery_confectionery", "meat_seafood_processing",
    "spinning", "weaving", "knitting", "dyeing_processing", "garment_manufacturing",
    "steel_metal_fabrication", "foundry_casting", "rolling_mill", "structural_fabrication",
]
NonEmpty = Annotated[str, Field(min_length=1, max_length=500)]
Identifier = Annotated[str, Field(min_length=1, max_length=100)]
PositiveInt = Annotated[int, Field(gt=0)]
NonNegativeNumber = Annotated[float, Field(ge=0, allow_inf_nan=False)]


class ContractModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid", strict=True, str_strip_whitespace=True,
        alias_generator=to_camel, populate_by_name=False,
    )


class BusinessProfile(ContractModel):
    legal_name: NonEmpty | None = None
    organisation_type: OrganisationType | None = None
    industry_sector: IndustrySector | None = None
    registration_number: Identifier | None = None
    pan: Annotated[str, Field(pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")] | None = None
    gstin: Annotated[str, Field(pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")] | None = None
    udyam_registration_number: Identifier | None = None


class Location(ContractModel):
    state_code: Annotated[str, Field(pattern=r"^[A-Z]{2}$")] | None = None
    district: NonEmpty | None = None
    taluka: NonEmpty | None = None
    postal_code: Annotated[str, Field(pattern=r"^[1-9][0-9]{5}$")] | None = None
    industrial_area: NonEmpty | None = None
    plot_number: Identifier | None = None
    plot_area_band: PlotAreaBand | None = None
    built_up_area_band: BuiltUpAreaBand | None = None
    land_status: Literal["owned", "leased", "midc_allotted", "under_acquisition"] | None = None


class InstalledCapacity(ContractModel):
    # The UI is free text and does not specify food/textile measurement units.
    raw_text: NonEmpty | None = None
    value: NonNegativeNumber | None = None
    unit: Literal["kg", "tonnes", "litres", "metres", "units"] | None = None
    period: Literal["day", "month", "year"] | None = None

    @model_validator(mode="after")
    def measurement_is_explicit(self) -> InstalledCapacity:
        parts = [self.value is not None, self.unit is not None, self.period is not None]
        if any(parts) and not all(parts):
            raise ValueError("A structured capacity needs value, unit and period together")
        return self


class Operations(ContractModel):
    primary_activity: PrimaryActivity | None = None
    project_stage: Literal["new_unit", "expansion", "modernisation"] | None = None
    investment_band: InvestmentBand | None = None
    installed_capacity: InstalledCapacity | None = None
    operating_shifts: Literal[1, 2, 3] | None = None
    has_boiler_or_pressure_vessel: bool | None = None
    boiler_capacity_band: Literal["up_to_1", "from_1_to_5", "from_5_to_10", "above_10"] | None = None
    boiler_working_pressure_kg_cm2: NonNegativeNumber | None = None
    handles_hazardous_chemicals: bool | None = None
    processes_used: list[Literal[
        "manufacturing_processing", "packaging_storage", "boiler_operation", "onsite_effluent_treatment"
    ]] | None = None

    @field_validator("operating_shifts", mode="before")
    @classmethod
    def shifts_are_integer(cls, value):
        if value is not None and type(value) is not int:
            raise ValueError("operatingShifts must be an integer, not a boolean or string")
        return value


class Utilities(ContractModel):
    electricity_demand_band: Literal["up_to_50", "from_50_to_100", "from_100_to_500", "from_500_to_1000", "above_1000"] | None = None
    dg_set_capacity_band: Literal["none", "up_to_125", "from_125_to_500", "from_500_to_1000", "above_1000"] | None = None
    daily_water_use_band: Literal["up_to_10", "from_10_to_50", "from_50_to_100", "from_100_to_500", "above_500"] | None = None
    water_source: Literal["midc_supply", "municipal_supply", "borewell", "surface_water", "tanker"] | None = None
    wastewater_discharge: Literal["common_treatment_facility", "onsite_treatment_plant", "zero_liquid_discharge", "municipal_sewer"] | None = None
    generates_hazardous_waste: bool | None = None


class Workforce(ContractModel):
    permanent_employee_band: Literal["less_than_10", "from_10_to_19", "from_20_to_49", "from_50_to_99", "from_100_to_499", "500_or_more"] | None = None
    contract_worker_band: Literal["none", "from_1_to_19", "from_20_to_49", "50_or_more"] | None = None
    women_employed_in_night_shift: bool | None = None
    worker_accommodation: Literal["not_provided", "onsite_quarters", "nearby_housing"] | None = None


class FoodDetails(ContractModel):
    sector: Literal["food"]
    fssai_licence_category: Literal["central_licence", "state_licence", "basic_registration"] | None = None
    cold_storage_capacity_band: Literal["none", "up_to_50", "from_50_to_500", "from_500_to_2000", "above_2000"] | None = None


class TextileDetails(ContractModel):
    sector: Literal["textile"]
    involves_dyeing_or_bleaching: bool | None = None
    looms_or_spindles_band: Literal["up_to_50", "from_50_to_200", "from_200_to_500", "above_500"] | None = None


class SteelDetails(ContractModel):
    sector: Literal["steel"]
    furnace_type: Literal["induction", "electric_arc", "cupola", "none"] | None = None
    furnace_capacity_band: Literal["up_to_5", "from_5_to_20", "from_20_to_50", "above_50"] | None = None


SectorDetails = Annotated[FoodDetails | TextileDetails | SteelDetails, Field(discriminator="sector")]


class ExtractedDocumentData(ContractModel):
    legal_name: NonEmpty | None = None
    address: NonEmpty | None = None
    registration_number: Identifier | None = None
    pan: Identifier | None = None
    gstin: Identifier | None = None


class DocumentMetadata(ContractModel):
    document_id: Identifier
    document_type: Identifier
    version: PositiveInt
    file_name: Annotated[str, Field(min_length=1, max_length=255, pattern=r"^[^/\\]+$")]
    mime_type: Annotated[str, Field(min_length=3, max_length=100)]
    size_bytes: PositiveInt
    verification_status: Literal["uploaded", "awaiting_verification", "verified", "rejected", "expired"]
    expires_on: date | None = None
    extracted_data: ExtractedDocumentData | None = None


ACTIVITIES_BY_SECTOR = {
    "food": {"food_beverage_processing", "dairy_cold_storage", "bakery_confectionery", "meat_seafood_processing"},
    "textile": {"spinning", "weaving", "knitting", "dyeing_processing", "garment_manufacturing"},
    "steel": {"steel_metal_fabrication", "foundry_casting", "rolling_mill", "structural_fabrication"},
}


class EvaluationRequest(ContractModel):
    request_id: Identifier
    application_id: Identifier
    application_version: PositiveInt
    evaluation_date: date
    business_profile: BusinessProfile
    location: Location
    operations: Operations
    utilities: Utilities
    workforce: Workforce
    sector_details: SectorDetails | None
    documents: list[DocumentMetadata] = Field(max_length=100)
    completed_approval_codes: list[Identifier] = Field(max_length=100)

    @model_validator(mode="after")
    def consistent_snapshot(self) -> EvaluationRequest:
        sector = self.business_profile.industry_sector
        if self.sector_details is not None and self.sector_details.sector != sector:
            raise ValueError("sectorDetails.sector must match businessProfile.industrySector")
        activity = self.operations.primary_activity
        if sector is not None and activity is not None and activity not in ACTIVITIES_BY_SECTOR[sector]:
            raise ValueError("primaryActivity must belong to the selected industrySector")
        keys = [(doc.document_id, doc.version) for doc in self.documents]
        if len(set(keys)) != len(keys):
            raise ValueError("Document ID/version pairs must be unique")
        if len(set(self.completed_approval_codes)) != len(self.completed_approval_codes):
            raise ValueError("completedApprovalCodes must be unique")
        return self
