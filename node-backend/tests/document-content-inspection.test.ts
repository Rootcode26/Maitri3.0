import { describe, expect, it } from 'vitest';

import {
  allowedMimeTypesForFormats,
  inspectFileContent,
} from '../src/modules/documents/document.content-inspection.js';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n', 'latin1');
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const TEXT = Buffer.from('just some plain text, not a real document');

describe('inspectFileContent', () => {
  it('detects a PDF from its content, not its name', async () => {
    expect((await inspectFileContent(PDF)).detectedMimeType).toBe('application/pdf');
  });

  it('detects a PNG from its magic bytes', async () => {
    expect((await inspectFileContent(PNG)).detectedMimeType).toBe('image/png');
  });

  it('returns null for content it cannot identify', async () => {
    expect((await inspectFileContent(TEXT)).detectedMimeType).toBeNull();
  });
});

describe('allowedMimeTypesForFormats', () => {
  it('maps display formats to concrete MIME types', () => {
    const allowed = allowedMimeTypesForFormats(['PDF', 'JPG', 'PNG']);
    expect(allowed.has('application/pdf')).toBe(true);
    expect(allowed.has('image/jpeg')).toBe(true);
    expect(allowed.has('image/png')).toBe(true);
    expect(allowed.has('application/zip')).toBe(false);
  });

  it('accepts both the OOXML and zip signatures for XLSX', () => {
    const allowed = allowedMimeTypesForFormats(['XLSX']);
    expect(allowed.has('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(
      true,
    );
    expect(allowed.has('application/zip')).toBe(true);
  });
});
