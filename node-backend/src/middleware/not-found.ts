import type { RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    status: 'error',
    code: 'ROUTE_NOT_FOUND',
    message: `Route ${request.method} not found`,
  });
};
