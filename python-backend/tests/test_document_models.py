import copy
import unittest
from pydantic import ValidationError
from app.domain.document_models import DocumentProcessingResult
from app.services.document_adapter import to_validation_document


def result_data():
    return {
        'documentId': 'sample-pan', 'version': 1, 'approvalKey': 'sample-approval',
        'documentKey': 'sample-pan', 'fileName': 'sample.pdf', 'storageKey': None,
        'mimeType': 'application/pdf', 'detectedMimeType': 'application/pdf',
        'sizeBytes': 1024, 'fileReadStatus': 'readable',
        'declaredDocumentType': 'company-pan', 'detectedDocumentType': 'company-pan',
        'typeConfirmed': True, 'subject': 'business', 'subjectConfirmed': True,
        'processingStatus': 'completed',
        'fields': [{'key': 'pan', 'value': 'AABCS1234F', 'status': 'confirmed',
                    'source': 'manual_review', 'confirmation': 'manual_review'}],
    }


class DocumentModelTests(unittest.TestCase):
    def setUp(self):
        self.data = result_data()

    def parse(self):
        return DocumentProcessingResult.model_validate(self.data)

    def test_confirmed_business_maps(self):
        doc = to_validation_document(self.parse())
        self.assertEqual(doc.extraction_status, 'succeeded')
        self.assertEqual(doc.extracted_data.pan, 'AABCS1234F')

    def test_personal_identity_never_compared_with_company(self):
        self.data['subject'] = 'signatory'
        doc = to_validation_document(self.parse())
        self.assertEqual(doc.extraction_status, 'review_required')
        self.assertIsNone(doc.extracted_data)

    def test_wrong_document_type_review(self):
        self.data['detectedDocumentType'] = 'other-document'
        self.assertEqual(to_validation_document(self.parse()).extraction_status, 'review_required')

    def test_confident_ocr_not_automatically_confirmed(self):
        self.data['fields'][0].update(source='ocr', confidence=1.0, confirmation=None)
        with self.assertRaises(ValidationError):
            self.parse()

    def test_uncertain_ocr_review(self):
        self.data['processingStatus'] = 'review_required'
        self.data['fields'][0].update(status='uncertain', source='ocr', confirmation=None)
        self.assertIsNone(to_validation_document(self.parse()).extracted_data)

    def test_failed_has_no_values(self):
        self.data['processingStatus'] = 'failed'
        with self.assertRaises(ValidationError):
            self.parse()

    def test_unprocessed_maps(self):
        self.data.update(processingStatus='not_processed', fields=[], detectedMimeType=None,
                         fileReadStatus='not_checked', typeConfirmed=False, subjectConfirmed=False)
        self.assertEqual(to_validation_document(self.parse()).extraction_status, 'not_run')

    def test_duplicate_fields_rejected(self):
        self.data['fields'].append(copy.deepcopy(self.data['fields'][0]))
        with self.assertRaises(ValidationError):
            self.parse()

    def test_unknown_subject_cannot_be_confirmed(self):
        self.data['subject'] = 'unknown'
        with self.assertRaises(ValidationError):
            self.parse()

    def test_unreadable_not_completed(self):
        self.data['fileReadStatus'] = 'unreadable'
        with self.assertRaises(ValidationError):
            self.parse()


if __name__ == '__main__':
    unittest.main()
