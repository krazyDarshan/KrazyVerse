import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const existing = req.headers['x-request-id'];
  req.requestId = typeof existing === 'string' ? existing : crypto.randomBytes(9).toString('base64url');
  res.setHeader('x-request-id', req.requestId);
  next();
}
