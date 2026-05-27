import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type AccessTokenPayload = {
  sub: string;
  role: string;
  deviceId: string;
};

export type RefreshTokenPayload = {
  sub: string;
  deviceId: string;
  tokenId: string;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    audience: 'krazyverse',
    issuer: 'krazyverse-api',
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    audience: 'krazyverse',
    issuer: 'krazyverse-api',
  } as SignOptions);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    audience: 'krazyverse',
    issuer: 'krazyverse-api',
  }) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    audience: 'krazyverse',
    issuer: 'krazyverse-api',
  }) as RefreshTokenPayload;
}
