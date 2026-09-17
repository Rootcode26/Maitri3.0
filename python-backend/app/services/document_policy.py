"""Server-only policy extensions; no shared request/response contract changes."""
from dataclasses import dataclass

COMPARABLE_FIELDS = frozenset({'enterpriseName', 'pan', 'gstin', 'cin', 'udyam', 'district', 'taluka', 'pincode', 'plotNumber'})


@dataclass(frozen=True)
class CrossDocumentRule:
    field: str
    bindings: tuple[tuple[str, str], ...]
    basis: str

    def __post_init__(self):
        if self.field not in COMPARABLE_FIELDS or len(set(self.bindings)) < 2 or not self.basis.strip():
            raise ValueError('Cross-document checks require an explicit comparable field, distinct bindings and basis')


@dataclass(frozen=True)
class DocumentValidationPolicy:
    cross_document_rules: tuple[CrossDocumentRule, ...] = ()
    # (approvalKey, documentKey, official/specification basis). No universal age limit.
    expiry_rules: tuple[tuple[str, str, str], ...] = ()

    def __post_init__(self):
        bindings = [(a, d) for a, d, basis in self.expiry_rules]
        if len(bindings) != len(set(bindings)) or any(not basis.strip() for _, _, basis in self.expiry_rules):
            raise ValueError('Expiry rules require unique bindings and an established basis')
