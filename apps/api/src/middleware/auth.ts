import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/http';
import { verifyAccessToken } from '../utils/tokens';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing bearer token', 'UNAUTHORIZED');
    }

    const payload = verifyAccessToken(header.slice('Bearer '.length));
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new ApiError(401, 'Account is not active', 'UNAUTHORIZED');
    }

    const session = await prisma.deviceSession.findUnique({
      where: { userId_deviceId: { userId: user.id, deviceId: payload.deviceId } },
      select: { revokedAt: true },
    });

    if (!session || session.revokedAt) {
      throw new ApiError(401, 'Device session is no longer active', 'SESSION_REVOKED');
    }

    req.user = { id: user.id, role: user.role, deviceId: payload.deviceId };
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, 'Invalid token', 'UNAUTHORIZED'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = { id: payload.sub, role: payload.role as UserRole, deviceId: payload.deviceId };
  } catch {
    // Anonymous access is allowed for public discovery routes.
  }
  return next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required', 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }
    return next();
  };
}
