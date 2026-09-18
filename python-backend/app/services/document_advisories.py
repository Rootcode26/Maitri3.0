"""Non-blocking advisories: when a candidate value read from a document differs
from what the applicant entered, warn (never block, never auto-correct). Only
high-precision identifiers are compared to avoid noisy false alarms."""
import re

from app.domain.api_contract_models import ContractIssue, ValidateRequest

_ADVISORY_KEYS = {'pan', 'gstin', 'cin', 'udyam'}
_LABELS = {
    'pan': 'PAN',
    'gstin': 'GSTIN',
    'cin': 'CIN',
    'udyam': 'Udyam registration number',
}


def _normalize(value: object) -> str:
    return re.sub(r'\s+', '', str(value)).upper()


def build_document_advisories(app, payload: ValidateRequest) -> list[ContractIssue]:
    provider = getattr(app.state, 'document_processor', None)
    if provider is None:
        return []

    form = payload.project.model_dump(by_alias=True)
    advisories: list[ContractIssue] = []
    seen: set[tuple[str, str]] = set()

    for upload in payload.documents:
        try:
            result = provider(upload)
        except Exception:
            continue
        for field in result.fields:
            if field.key not in _ADVISORY_KEYS or field.value is None:
                continue
            entered = form.get(field.key)
            if not entered or _normalize(field.value) == _normalize(entered):
                continue
            marker = (result.document_id, field.key)
            if marker in seen:
                continue
            seen.add(marker)
            label = _LABELS.get(field.key, field.key)
            advisories.append(
                ContractIssue.model_validate({
                    'code': 'DOCUMENT_VALUE_LOOKS_DIFFERENT',
                    'severity': 'warning',
                    'field': 'project.' + field.key,
                    'approvalKey': result.approval_key,
                    'documentKey': result.document_key,
                    'documentId': result.document_id,
                    'message': (
                        f'The {label} on the uploaded document appears to read '
                        f'"{field.value}", which differs from the "{entered}" you entered.'
                    ),
                    'suggestedAction': (
                        'Check both. Fix the entry if it is a typo, re-upload the correct '
                        'document if the file is wrong, or submit for officer review. Do not '
                        'change a correct answer to match a possible reading error.'
                    ),
                })
            )
    return advisories
