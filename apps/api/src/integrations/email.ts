import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

export async function sendEmail(options: { to: string; subject: string; text: string; html?: string }) {
  if (env.NODE_ENV === 'test') {
    return;
  }

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (error) {
    logger.warn('Email delivery failed', { error, to: options.to, subject: options.subject });
  }
}

export async function sendOtpEmail(to: string, code: string, purpose: string) {
  await sendEmail({
    to,
    subject: `Your KrazyVerse ${purpose.toLowerCase().replaceAll('_', ' ')} code`,
    text: `Your KrazyVerse verification code is ${code}. It expires in 5 minutes.`,
    html: `<p>Your KrazyVerse verification code is <strong>${code}</strong>.</p><p>It expires in 5 minutes.</p>`,
  });
}

export async function sendSuspiciousLoginEmail(to: string, details: { ip?: string; userAgent?: string }) {
  await sendEmail({
    to,
    subject: 'New KrazyVerse login detected',
    text: `We detected a login from a new device. IP: ${details.ip ?? 'unknown'} User-Agent: ${
      details.userAgent ?? 'unknown'
    }. If this was not you, revoke the session immediately.`,
  });
}
