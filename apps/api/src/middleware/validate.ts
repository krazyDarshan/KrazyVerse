import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject, ZodTypeAny } from 'zod';
import { ApiError } from '../utils/http';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodTypeAny, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[target]);
    if (!parsed.success) {
      return next(new ApiError(422, 'Validation failed', 'VALIDATION_ERROR', parsed.error.flatten()));
    }
    req[target] = parsed.data;
    return next();
  };
}

export function validateMany(schemas: Partial<Record<ValidationTarget, AnyZodObject>>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const [target, schema] of Object.entries(schemas) as [ValidationTarget, AnyZodObject][]) {
      const parsed = schema.safeParse(req[target]);
      if (!parsed.success) {
        return next(new ApiError(422, 'Validation failed', 'VALIDATION_ERROR', parsed.error.flatten()));
      }
      req[target] = parsed.data;
    }
    return next();
  };
}
