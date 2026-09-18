import type { RequestHandler } from 'express';

import { AppError } from '../../errors/app-error.js';
import {
  documentIdParamSchema,
  projectIdParamSchema,
  uploadDocumentSchema,
} from './document.schemas.js';
import type { DocumentService } from './document.service.js';
import type { ProjectDocumentRecord } from './document.types.js';

const serialize = ({ storageKey: _storageKey, ...rest }: ProjectDocumentRecord) => rest;

export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  readonly upload: RequestHandler = async (request, response) => {
    if (!request.file) {
      throw new AppError('A file is required', { statusCode: 400, code: 'FILE_REQUIRED' });
    }
    const projectId = projectIdParamSchema.parse(request.params.id);
    const input = uploadDocumentSchema.parse(request.body);
    const document = await this.documentService.uploadDocument(
      request.user!.userId,
      projectId,
      input,
      {
        buffer: request.file.buffer,
        originalName: request.file.originalname,
        mimeType: request.file.mimetype,
        size: request.file.size,
      },
    );
    response.status(201).json({ status: 'success', data: { document: serialize(document) } });
  };

  readonly list: RequestHandler = async (request, response) => {
    const projectId = projectIdParamSchema.parse(request.params.id);
    const documents = await this.documentService.listDocuments(request.user!.userId, projectId);
    response.status(200).json({ status: 'success', data: { documents: documents.map(serialize) } });
  };

  readonly remove: RequestHandler = async (request, response) => {
    const projectId = projectIdParamSchema.parse(request.params.id);
    const documentId = documentIdParamSchema.parse(request.params.documentId);
    await this.documentService.deleteDocument(request.user!.userId, projectId, documentId);
    response.status(204).send();
  };

  readonly download: RequestHandler = async (request, response) => {
    const projectId = projectIdParamSchema.parse(request.params.id);
    const documentId = documentIdParamSchema.parse(request.params.documentId);
    const url = await this.documentService.getDownloadUrl(
      request.user!.userId,
      projectId,
      documentId,
    );
    response.status(200).json({ status: 'success', data: { url } });
  };

  readonly validate: RequestHandler = async (request, response) => {
    const projectId = projectIdParamSchema.parse(request.params.id);
    const result = await this.documentService.validateProject(request.user!.userId, projectId);
    response.status(200).json({ status: 'success', data: { validation: result } });
  };
}
