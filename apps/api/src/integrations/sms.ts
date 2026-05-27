import Twilio from 'twilio';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const twilio =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : null;

export async function sendSmsOtp(phone: string, _code: string) {
  if (env.NODE_ENV === 'test') {
    return;
  }

  if (!twilio || !env.TWILIO_VERIFY_SERVICE_SID) {
    logger.info('Twilio not configured; SMS OTP generated locally', { phone });
    return;
  }

  try {
    await twilio.verify.v2.services(env.TWILIO_VERIFY_SERVICE_SID).verifications.create({
      to: phone,
      channel: 'sms',
    });
  } catch (error) {
    logger.warn('Twilio verification send failed; local OTP still available', { error, phone });
  }
}

export async function verifyTwilioOtp(phone: string, code: string) {
  if (!twilio || !env.TWILIO_VERIFY_SERVICE_SID || env.NODE_ENV === 'test') {
    return true;
  }

  const result = await twilio.verify.v2
    .services(env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: phone, code });

  return result.status === 'approved';
}
