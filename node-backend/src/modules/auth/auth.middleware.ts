import type { RequestHandler } from 'express';

import { AppError } from '../../errors/app-error.js';
import { ACCESS_TOKEN_COOKIE } from './auth.cookies.js';
import { isAccessTokenRevoked } from './access-token-store.js';
import { verifyAccessToken } from './token.service.js';
import type { AuthenticatedUser, UserRole } from './auth.types.js';

type ScopeResolver = (request: Parameters<RequestHandler>[0]) => string | null | undefined;

const authenticatedUser = (request: Parameters<RequestHandler>[0]): AuthenticatedUser => {
  if (!request.user) {
    throw new AppError('Authentication is required', {
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
  }
  return request.user;
};

const forbidden = (message = 'You do not have permission to access this resource'): AppError =>
  new AppError(message, { statusCode: 403, code: 'FORBIDDEN' });

export const requireAuthentication: RequestHandler = async (request, _response, next) => {
  const token = request.cookies[ACCESS_TOKEN_COOKIE] as unknown;
  if (typeof token !== 'string' || token.length === 0) {
    throw new AppError('Authentication is required', {
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
  }

  const user = verifyAccessToken(token);
  if (await isAccessTokenRevoked(user.jti)) {
    throw new AppError('Authentication token has been revoked', {
      statusCode: 401,
      code: 'JWT_REVOKED',
    });
  }

  request.user = user;
  next();
};

/** Must run after requireAuthentication. */
export const requireRoles = (...allowedRoles: readonly UserRole[]): RequestHandler => {
  if (allowedRoles.length === 0) throw new TypeError('requireRoles needs at least one role');
  const allowed = new Set<UserRole>(allowedRoles);
  return (request, _response, next) => {
    if (!allowed.has(authenticatedUser(request).role)) throw forbidden();
    next();
  };
};

/** Allows the resource owner and explicitly listed privileged roles. */
export const requireSelfOrRoles = (
  resolveOwnerUserId: ScopeResolver,
  ...privilegedRoles: readonly UserRole[]
): RequestHandler => {
  const privileged = new Set<UserRole>(privilegedRoles);
  return (request, _response, next) => {
    const user = authenticatedUser(request);
    const ownerUserId = resolveOwnerUserId(request);
    if (!ownerUserId)
      throw new AppError('Resource owner is required', {
        statusCode: 400,
        code: 'RESOURCE_OWNER_REQUIRED',
      });
    if (user.userId !== ownerUserId && !privileged.has(user.role)) throw forbidden();
    next();
  };
};

/** Allows an inspector to access resources belonging to their own department. */
export const requireDepartmentAccess =
  (resolveDepartmentId: ScopeResolver): RequestHandler =>
  (request, _response, next) => {
    const user = authenticatedUser(request);
    const resourceDepartmentId = resolveDepartmentId(request);
    if (!resourceDepartmentId) {
      throw new AppError('Resource department is required', {
        statusCode: 400,
        code: 'RESOURCE_DEPARTMENT_REQUIRED',
      });
    }
    if (
      user.role !== 'inspector' ||
      !user.departmentId ||
      user.departmentId !== resourceDepartmentId
    ) {
      throw forbidden('You cannot access resources outside your department');
    }
    next();
  };

export const routeParam =
  (name: string): ScopeResolver =>
  (request) => {
    const value = request.params[name];
    return typeof value === 'string' ? value : undefined;
  };
