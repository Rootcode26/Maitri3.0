# Document-processing models (foundation, not an OCR implementation)

P1 owns the final document catalog and checklist. These models are independent
of that list; company-pan is a test label, not an approved regulatory requirement.

app/domain/document_models.py describes one uploaded document version and the
processor's output. Each field records its source, optional page/confidence,
and confirmed/uncertain/not_found status. Raw text and file bytes are deliberately
excluded from this contract. Do not log credential values or store raw OCR text
in application logs.

Only a trusted backend processor/reviewer can supply this result. Applicants must
not choose confirmed states. Confirmed means a reviewer or trusted structured
source confirmed the extraction; it does not establish document authenticity.
OCR confidence alone cannot confirm extraction, document type or subject.

app/services/document_adapter.py maps results to the existing UploadedDocument
input for /validate without changing its request or response contract. Only a
completed result with a matching confirmed type and confirmed business subject
supplies extractedData. Unknown type, mismatched type, uncertain OCR and personal
signatory identity produce review_required instead. P1 must also configure
fieldsToCompare; the adapter cannot create a comparison policy from narrative text.

The adapter deliberately drops candidate values when review is required. Keep
the processing result in a secure backend review record to show the reviewer
the reason/page; do not expose unconfirmed candidates as authoritative answers.
It cannot validate signatory credentials yet. Absent fields remain missing, never
guessed. Only independently confirmed expiry is forwarded; null expiry does not
prove that a document has no expiry.

The registered P1 evaluator now supplies the trusted catalog to /validate.
app/services/document_processing.py adds an explicit byte-processing boundary and
an optional existing-worker adapter. Actual byte length replaces submitted size;
configured content parsers establish actual MIME/readability. A signature alone
keeps readability unknown; ZIP alone never establishes XLSX. Corrupt/encrypted/
unsupported outputs and missing/failed providers cannot produce successful
comparisons. Worker results must match the current document/version/binding.
Confirmed personal signatory fields still never become enterprise credentials.

No production parser/OCR or storage transport is installed/configured. The current
environment lacks pypdf, Pillow and openpyxl; no dependencies were installed.
The owner must provide bounded parsers/extraction workers and owned storage access
through the existing processing interface, or send trusted processing snapshots
through the internal Node transport. Test providers are explicitly synthetic and
never registered in production. No upload/storage infrastructure was added.

Validity and cross-document checks use server-only DocumentValidationPolicy;
they need an established basis and explicit document bindings. No universal
document lifetime or automatic identity/authenticity verification is implemented.
PAN/GSTIN shape and matching checks do not prove government registration.

Tests: .venv/Scripts/python.exe -B -m unittest discover -s tests -p 'test_document*.py' -v
