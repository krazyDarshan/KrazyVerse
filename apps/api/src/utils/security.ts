import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function hashSecret(value: string) {
  return bcrypt.hash(value, 12);
}

export async function verifySecret(value: string, hash: string) {
  return bcrypt.compare(value, hash);
}

export function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOpaqueToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newOpaqueToken(prefix: string) {
  return `${prefix}_${crypto.randomBytes(36).toString('base64url')}`;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
