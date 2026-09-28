import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

// Tracks whether a document's bytes have actually reached object storage. With
// synchronous uploads every row is 'stored'; with background storage a row is
// created 'pending' and a worker flips it to 'stored' (or 'failed').
export const up = (pgm: MigrationBuilder): void => {
  pgm.createType('document_storage_status', ['pending', 'stored', 'failed']);
  pgm.addColumn('project_documents', {
    storage_status: { type: 'document_storage_status', notNull: true, default: 'stored' },
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropColumn('project_documents', 'storage_status');
  pgm.dropType('document_storage_status');
};
