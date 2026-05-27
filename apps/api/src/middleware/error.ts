import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { ApiError, fail } from '../utils/http';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.path}`, 'NOT_FOUND'));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return fail(res, err.statusCode, err.message, err.code, err.details);
  }

  if (err instanceof ZodError) {
    return fail(res, 422, 'Validation failed', 'VALIDATION_ERROR', err.flatten());
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return fail(res, 409, 'A record with these unique fields already exists', 'CONFLICT', err.meta);
    }
    if (err.code === 'P2025') {
      return fail(res, 404, 'Record not found', 'NOT_FOUND', err.meta);
    }
  }

  logger.error('Unhandled request error', {
    err,
    path: req.path,
    method: req.method,
    requestId: req.requestId,
  });

  return fail(res, 500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
}
