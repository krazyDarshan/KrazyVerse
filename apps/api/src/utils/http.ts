import type { Response } from 'express';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = 'API_ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(
  res: Response,
  data: T,
  message = 'OK',
  meta?: Record<string, unknown>,
  statusCode = 200,
) {
  return res.status(statusCode).json({ success: true, data, message, meta });
}

export function created<T>(res: Response, data: T, message = 'Created') {
  return ok(res, data, message, undefined, 201);
}

export function fail(
  res: Response,
  statusCode: number,
  message: string,
  code = 'API_ERROR',
  details?: unknown,
) {
  return res.status(statusCode).json({
    success: false,
    message,
    error: { code, details },
  });
}

export function getPagination(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 50);
  const cursor = typeof query.cursor === 'string' && query.cursor.length > 0 ? query.cursor : undefined;
  return { limit, cursor };
}
