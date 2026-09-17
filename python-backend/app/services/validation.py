"""Deterministic questionnaire + trusted metadata checks. No OCR or risk scoring."""
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from difflib import SequenceMatcher
from pathlib import PurePath
import re

from app.domain.api_contract_models import ContractIssue, DocumentCheck, ValidateResponse
from app.services.rule_provider import RulesUnavailable
from app.services.document_policy import DocumentValidationPolicy

FORMATS = {
    "PDF": ("application/pdf", {"pdf"}),
    "JPG": ("image/jpeg", {"jpg", "jpeg"}),
    "PNG": ("image/png", {"png"}),
    "XLSX": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", {"xlsx"}),
}
REQUIRED_FIELDS = [
    "enterpriseName", "organisationType", "industry", "pan", "district", "pincode",
    "plotArea", "landStatus", "primaryActivity", "projectStage", "boiler",
    "hazardousChemicals", "electricity", "waterUse", "wastewater", "hazardousWaste", "permanent",
]
ACTIVITIES = {
    "food": {"Food & beverage processing", "Dairy & cold storage", "Bakery & confectionery", "Meat & seafood processing"},
    "textile": {"Spinning", "Weaving", "Knitting", "Dyeing & processing", "Garment manufacturing"},
    "steel": {"Steel & metal fabrication", "Foundry / casting", "Rolling mill", "Structural fabrication"},
}
IDENTIFIERS = {"pan", "gstin", "cin", "udyam"}
EXTRACTED_PATTERNS = {
    "pan": r"[A-Z]{5}[0-9]{4}[A-Z]",
    "gstin": r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]",
}
FIELD_LABELS = {
    "enterpriseName": "business name", "organisationType": "organisation type",
    "primaryActivity": "primary activity", "projectStage": "project stage",
    "plotArea": "plot area", "landStatus": "land status", "pan": "PAN",
    "gstin": "GSTIN", "cin": "CIN", "udyam": "Udyam number",
    "pincode": "PIN code", "hazardousChemicals": "hazardous chemicals answer",
    "waterUse": "water consumption", "hazardousWaste": "hazardous waste answer",
    "permanent": "permanent employee count", "fssaiCategory": "FSSAI category",
    "wetProcessing": "wet processing answer", "furnaceType": "furnace type",
    "plotNumber": "plot number",
}


def normalize_text(value):
    return " ".join(value.casefold().split())


def text_correction_action(field, expected, actual):
    label = FIELD_LABELS.get(field, field)
    similarity = SequenceMatcher(None, normalize_text(expected), normalize_text(actual)).ratio()
    if similarity >= 0.8:
        return f"Check {label} for a possible spelling or abbreviation difference. Confirm against the original document before changing the answer; extraction may be incorrect."
    return f"Check that this document belongs to the same business/project and compare its {label} with your answer. Correct the answer or replace the document only after confirming the original."


def validate_application(request, evaluation, *, evaluated_at=None, policy=None):
    now = evaluated_at or datetime.now(timezone.utc)
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Evaluation time must be timezone-aware")
    if evaluation.project_id != request.project_id or evaluation.rules_version != request.rules_version:
        raise RulesUnavailable("Evaluation snapshot does not match request")

    issues, checks = [], []
    policy = policy or DocumentValidationPolicy()
    expiry_bindings = {(a, d) for a, d, _ in policy.expiry_rules}
    comparable = defaultdict(list)

    def issue(code, severity, message, action, *, field=None, doc=None, approval=None, document_key=None):
        issues.append(ContractIssue.model_validate({
            "code": code, "severity": severity, "field": field,
            "approvalKey": doc.approval_key if doc else approval,
            "documentKey": doc.document_key if doc else document_key,
            "documentId": doc.document_id if doc else None,
            "message": message, "suggestedAction": action,
        }))

    def check(doc, field, status, reason):
        checks.append(DocumentCheck.model_validate({
            "documentId": doc.document_id, "approvalKey": doc.approval_key,
            "documentKey": doc.document_key, "field": field, "status": status, "reason": reason,
        }))

    project = request.project.model_dump(by_alias=True)
    for field in REQUIRED_FIELDS:
        if project[field] is None:
            label = FIELD_LABELS.get(field, field)
            issue("REQUIRED_FIELD_MISSING", "error", f"The {label} is missing.", f"Fill in the {label}, then run validation again.", field="project." + field)
    conditional = {"food": "fssaiCategory", "textile": "wetProcessing", "steel": "furnaceType"}
    sector = project["industry"]
    if sector in conditional and project[conditional[sector]] is None:
        field = conditional[sector]
        issue("REQUIRED_FIELD_MISSING", "error", f"{field} is required for this industry.", f"Answer the {field} question.", field="project." + field)
    if project["boiler"] == "yes" and project["boilerCapacity"] is None:
        issue("REQUIRED_FIELD_MISSING", "error", "Boiler capacity is required when a boiler is present.", "Select the boiler capacity.", field="project.boilerCapacity")
    if sector in ACTIVITIES and project["primaryActivity"] is not None and project["primaryActivity"] not in ACTIVITIES[sector]:
        issue("INDUSTRY_ACTIVITY_MISMATCH", "error", "The primary activity does not belong to the selected industry.", "Correct the industry or primary activity.", field="project.primaryActivity")
    if project["pan"] is not None and project["gstin"] is not None and project["gstin"][2:12] != project["pan"]:
        issue("IDENTIFIER_RELATION_MISMATCH", "error", "The PAN embedded in GSTIN differs from the entered PAN.", "Check both identifiers and enter values for the same business.", field="project.gstin")
    if project["boiler"] == "no" and (
        project["boilerCapacity"] is not None or project["boilerPressure"] is not None
        or "Boiler operation" in (project["processes"] or [])
    ):
        issue("CONTRADICTORY_ANSWERS", "error", "Boiler details conflict with the No boiler answer.", "Correct the boiler answer or remove the boiler details.", field="project.boiler")
    if project["furnaceType"] == "None" and project["furnaceCapacity"] is not None:
        issue("CONTRADICTORY_ANSWERS", "error", "Furnace capacity was supplied despite selecting no furnace.", "Remove the capacity or correct the furnace type.", field="project.furnaceCapacity")
    if sector == "textile" and project["primaryActivity"] == "Dyeing & processing" and project["wetProcessing"] == "no":
        issue("ANSWER_CLARIFICATION_NEEDED", "warning", "Dyeing activity conflicts with the No dyeing/bleaching answer.", "Clarify the actual processes used.", field="project.wetProcessing")
    approvals = {item.key: item for item in evaluation.approvals}
    selected = set(request.selected_approval_keys) if request.selected_approval_keys is not None else set(approvals)
    for approval in evaluation.approvals:
        # Ensure dependency/configuration failures aren't converted to empty success.
        if approval.key in selected and not approval.documents:
            issue("DOCUMENT_REQUIREMENTS_REVIEW_NEEDED", "review", "This approval has no configured document requirements.", "Ask the responsible department to confirm its document requirements.", approval=approval.key)
    issues.extend(evaluation.blocking_issues)

    for key in sorted(selected - set(approvals)):
        issue("UNKNOWN_APPROVAL", "error", "A selected approval is not in the trusted checklist.", "Regenerate the checklist and select an applicable approval.", approval=key)

    requirements = {
        (approval.key, requirement.key): requirement
        for approval in evaluation.approvals if approval.key in selected
        for requirement in approval.documents
    }
    grouped = defaultdict(list)
    for doc in request.documents:
        key = (doc.approval_key, doc.document_key)
        if key not in requirements:
            issue("UNKNOWN_DOCUMENT_BINDING", "error", "The upload is not linked to a document in the selected trusted checklist.", "Attach it to the correct approval and document requirement.", doc=doc)
            continue
        grouped[key].append(doc)

    for (approval_key, document_key), requirement in requirements.items():
        uploads = grouped[(approval_key, document_key)]
        unique_files = {doc.document_id for doc in uploads}
        if requirement.required and len(unique_files) < requirement.files_required:
            issue("REQUIRED_DOCUMENT_MISSING", "error", f"{requirement.name} needs at least {requirement.files_required} file(s); {len(unique_files)} supplied.", "Upload the remaining required file(s).", field="documents", approval=approval_key, document_key=document_key)
        if len(uploads) > len(unique_files):
            issue("MULTIPLE_DOCUMENT_VERSIONS", "error", "Multiple versions of the same file were supplied for this requirement.", "Send only the current version of each file.", field="documents", approval=approval_key, document_key=document_key)

        allowed_mimes = {FORMATS[fmt][0] for fmt in requirement.formats}
        allowed_extensions = set().union(*(FORMATS[fmt][1] for fmt in requirement.formats))
        for doc in uploads:
            file_invalid = False
            extension = PurePath(doc.file_name).suffix.lstrip(".").casefold()
            if extension not in allowed_extensions:
                issue("DOCUMENT_FORMAT_NOT_ALLOWED", "error", "The file extension is not allowed for this document.", "Upload the original document as " + ", ".join(requirement.formats) + "; renaming its extension does not convert it.", doc=doc)
                file_invalid = True
            # Decimal MB is explicit; do not confuse with binary MiB.
            if Decimal(doc.size_bytes) > Decimal(str(requirement.max_size_mb)) * 1_000_000:
                issue("DOCUMENT_TOO_LARGE", "error", f"The file exceeds the {requirement.max_size_mb:g} MB limit.", "Reduce file size without losing readability and upload again.", doc=doc)
                file_invalid = True
            if doc.detected_mime_type is None:
                issue("FILE_TYPE_NOT_VERIFIED", "review", "Actual file type has not been checked.", "Run trusted file-content validation or request review.", doc=doc)
                check(doc, None, "unavailable", "Actual file type is unknown.")
            elif doc.detected_mime_type not in allowed_mimes:
                issue("DOCUMENT_FORMAT_NOT_ALLOWED", "error", "Detected file content is not an accepted format.", "Upload a file with an accepted actual format.", doc=doc)
                file_invalid = True
            elif extension in allowed_extensions:
                detected_extensions = next(exts for mime, exts in FORMATS.values() if mime == doc.detected_mime_type)
                if extension not in detected_extensions:
                    issue("FILE_TYPE_MISMATCH", "error", "The filename extension conflicts with detected file content.", "Upload the original correctly named file.", doc=doc)
                    file_invalid = True
            if doc.detected_mime_type is not None and doc.mime_type != doc.detected_mime_type:
                issue("DECLARED_FILE_TYPE_MISMATCH", "warning", "Declared MIME type differs from detected content.", "Check the upload metadata and original file type.", doc=doc)
            if doc.file_read_status in {"unreadable", "password_protected"}:
                issue("DOCUMENT_UNREADABLE", "error", "The file cannot be read or is password-protected.", "Upload a readable, unprotected document.", doc=doc)
                file_invalid = True
            elif doc.file_read_status == "not_checked":
                issue("DOCUMENT_READ_CHECK_PENDING", "review", "Document readability has not been checked.", "Read the file through the trusted document processor.", doc=doc)
                check(doc, None, "unavailable", "Readability has not been checked.")
            if (approval_key, document_key) in expiry_bindings and doc.expires_on is None:
                issue("DOCUMENT_EXPIRY_REVIEW_NEEDED", "review", "This document requires an established expiry check, but confirmed expiry is unavailable.", "Confirm the expiry from the original document and revalidate.", doc=doc)
            elif (approval_key, document_key) not in expiry_bindings and doc.expires_on is not None:
                issue("DOCUMENT_VALIDITY_POLICY_UNRESOLVED", "review", "An expiry was supplied without an established validity policy for this document type.", "Ask the checklist owner to confirm the applicable validity rule.", doc=doc)
            elif doc.expires_on is not None and doc.expires_on < now.date():
                issue("DOCUMENT_EXPIRED", "error", "The document has expired.", "Upload a current document.", doc=doc)
                file_invalid = True
            if file_invalid:
                continue
            # Pending content inspection must never support a matched comparison.
            if doc.detected_mime_type is None or doc.file_read_status != "readable":
                if requirement.fields_to_compare:
                    issue("DOCUMENT_EXTRACTION_REVIEW_NEEDED", "review", "Required details cannot be compared before content inspection and readability are confirmed.", "Run the trusted processor or request manual review.", doc=doc)
                continue

            if doc.extraction_status != "succeeded":
                issue("DOCUMENT_PROCESSING_UNRESOLVED", "review", "Document extraction is missing, failed or uncertain.", "Run the configured trusted processor or obtain manual review, then revalidate.", doc=doc)
                check(doc, None, "unavailable", "Extraction does not establish usable document content.")

            if requirement.fields_to_compare:
                if doc.extraction_status != "succeeded" or doc.extracted_data is None:
                    issue("DOCUMENT_EXTRACTION_REVIEW_NEEDED", "review", "Required details could not be reliably extracted.", "Upload a clearer document or request manual review.", doc=doc)
                    check(doc, None, "unavailable", "Credential comparison could not be performed.")
                else:
                    extracted = doc.extracted_data.model_dump(by_alias=True)
                    for field in dict.fromkeys(requirement.fields_to_compare):
                        actual, expected = extracted.get(field), project.get(field)
                        if actual is None or expected is None:
                            issue("COMPARISON_DATA_MISSING", "review", f"{field} could not be compared.", "Provide the missing answer or review the extracted document details.", field="project." + field, doc=doc)
                            check(doc, field, "unavailable", "One or both comparison values are missing.")
                        elif field in IDENTIFIERS:
                            actual, expected = actual.strip().upper(), expected.strip().upper()
                            if field in EXTRACTED_PATTERNS and not re.fullmatch(EXTRACTED_PATTERNS[field], actual):
                                issue("EXTRACTED_FIELD_UNRELIABLE", "review", f"The extracted {field} has an invalid format; identity/authenticity has not been verified.", "Review extraction accuracy or upload a clearer file.", field="project." + field, doc=doc)
                                check(doc, field, "review_required", "Extracted value may contain OCR errors.")
                            elif actual != expected:
                                comparable[(approval_key, document_key, field)].append((doc, actual))
                                label = FIELD_LABELS.get(field, field)
                                issue("DOCUMENT_DATA_MISMATCH", "error", f"The entered {label} differs from the document's {label}.", f"Compare the {label} against the original document. Correct the entered value or upload the correct business document; if extraction is wrong, request review rather than changing a correct answer.", field="project." + field, doc=doc)
                                check(doc, field, "mismatched", "Values differ after trimming and capitalization.")
                            else:
                                comparable[(approval_key, document_key, field)].append((doc, actual))
                                check(doc, field, "matched", "Identifier values match; authenticity was not verified.")
                        elif normalize_text(actual) == normalize_text(expected):
                            comparable[(approval_key, document_key, field)].append((doc, normalize_text(actual)))
                            check(doc, field, "matched", "Values match after case and whitespace normalization.")
                        else:
                            comparable[(approval_key, document_key, field)].append((doc, normalize_text(actual)))
                            label = FIELD_LABELS.get(field, field)
                            issue("DOCUMENT_TEXT_REVIEW_NEEDED", "review", f"The entered and extracted {label} differ.", text_correction_action(field, expected, actual), field="project." + field, doc=doc)
                            check(doc, field, "review_required", "Text differs; this is not automatically treated as false information.")

            if requirement.must_include or requirement.quality:
                issue("DOCUMENT_CONTENT_REVIEW_NEEDED", "review", "Content/quality instructions require document review; metadata does not prove they are satisfied.", "Review the document against the checklist instructions.", doc=doc)
                check(doc, None, "review_required", "Narrative content/quality requirements have not been automatically verified.")
            if not requirement.fields_to_compare and not requirement.must_include and not requirement.quality:
                issue("DOCUMENT_CONTENT_POLICY_MISSING", "review", "No document-content validation policy is configured.", "Ask the checklist owner to configure content checks.", doc=doc)
                check(doc, None, "review_required", "Format checks alone do not establish document correctness.")

    for rule in policy.cross_document_rules:
        active = [binding for binding in rule.bindings if binding[0] in selected]
        if len(active) < 2:
            continue
        values = []
        for approval_key, document_key in active:
            requirement = requirements.get((approval_key, document_key))
            extracted = comparable[(approval_key, document_key, rule.field)]
            if requirement is None or rule.field not in requirement.fields_to_compare or not extracted:
                issue("CROSS_DOCUMENT_COMPARISON_UNAVAILABLE", "review", f"Configured cross-document {rule.field} comparison cannot be completed.", "Confirm the comparison policy and provide reliably extracted business documents.", field="project." + rule.field, approval=approval_key, document_key=document_key)
            values.extend(extracted)
        if len({value for _, value in values}) > 1:
            for doc, _ in values:
                issue("CROSS_DOCUMENT_CONFLICT", "review", f"Business documents contain conflicting {rule.field} values.", "Review each original, correct extraction or replace the incorrect document, then revalidate.", field="project." + rule.field, doc=doc)
                check(doc, rule.field, "review_required", "Explicitly configured cross-document values conflict; authenticity is not established.")

    errors = [item for item in issues if item.severity == "error"]
    warnings = [item for item in issues if item.severity == "warning"]
    reviews = [item for item in issues if item.severity == "review"]
    return ValidateResponse.model_validate({
        "rulesVersion": request.rules_version, "projectId": request.project_id,
        "projectVersion": request.project_version, "evaluatedAt": now,
        "validationStatus": "review_required" if reviews or any(item.code.startswith('REGULATORY_') or item.code == 'SUBMISSION_BLOCKED' for item in errors) else "complete",
        "blockingIssues": [item.model_dump(by_alias=True) for item in errors],
        "warnings": [item.model_dump(by_alias=True) for item in warnings],
        "reviewItems": [item.model_dump(by_alias=True) for item in reviews],
        "documentChecks": [item.model_dump(by_alias=True) for item in checks],
    })
