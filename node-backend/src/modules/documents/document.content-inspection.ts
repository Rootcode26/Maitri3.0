import { fileTypeFromBuffer } from 'file-type';

import type { DocumentReadStatus } from './document.types.js';

export const FORMAT_MIME_TYPES: Record<string, readonly string[]> = {
  PDF: ['application/pdf'],
  JPG: ['image/jpeg'],
  JPEG: ['image/jpeg'],
  PNG: ['image/png'],
  XLSX: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
};

export interface InspectionResult {
  detectedMimeType: string | null;
}

export const inspectFileContent = async (buffer: Buffer): Promise<InspectionResult> => {
  const detected = await fileTypeFromBuffer(buffer);
  return { detectedMimeType: detected?.mime ?? null };
};

export const allowedMimeTypesForFormats = (formats: readonly string[]): Set<string> => {
  const mimes = new Set<string>();
  for (const format of formats) {
    for (const mime of FORMAT_MIME_TYPES[format.toUpperCase()] ?? []) mimes.add(mime);
  }
  return mimes;
};

export const determineReadStatus = (
  buffer: Buffer,
  detectedMimeType: string,
): DocumentReadStatus => {
  if (detectedMimeType === 'application/pdf' && buffer.toString('latin1').includes('/Encrypt')) {
    return 'password_protected';
  }
  return 'readable';
};
