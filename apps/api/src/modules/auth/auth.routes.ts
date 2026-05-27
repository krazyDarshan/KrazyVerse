import { Router } from 'express';
import { AuthProvider, OtpPurpose } from '@prisma/client';
import { z } from 'zod';
import { authSchemas } from '@krazyverse/shared';
import { asyncHandler } from '../../utils/async-handler';
import { created, ok } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { redisRateLimit } from '../../middleware/rate-limit';
import { requireAuth } from '../../middleware/auth';
import { authService } from './auth.service';

const router = Router();
const authLimit = redisRateLimit({ prefix: 'auth', windowMs: 15 * 60 * 1000, max: 40 });

function context(req: any) {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

router.post(
  '/signup',
  authLimit,
  validate(authSchemas.signup),
  asyncHandler(async (req, res) => {
    const result = await authService.signup({ ...req.body, context: context(req) });
    return created(res, result, 'Signup successful. Check your email for a verification code.');
  }),
);

router.post(
  '/login',
  authLimit,
  validate(authSchemas.login),
  asyncHandler(async (req, res) => {
    const result = await authService.login({ ...req.body, context: context(req) });
    return ok(res, result, 'Login successful');
  }),
);

router.post(
  '/refresh',
  authLimit,
  validate(authSchemas.refresh),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body.refreshToken, req.body.deviceId, context(req));
    return ok(res, result, 'Token refreshed');
  }),
);

router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.logout(req.user!.id, req.user!.deviceId);
    return ok(res, result, 'Logged out');
  }),
);

router.post(
  '/verify-otp',
  authLimit,
  validate(authSchemas.verifyOtp),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyOtp({
      ...req.body,
      purpose: req.body.purpose as OtpPurpose,
    });
    return ok(res, result, 'OTP verified');
  }),
);

router.post(
  '/resend-email-otp',
  authLimit,
  validate(z.object({ email: authSchemas.forgotPassword.shape.email })),
  asyncHandler(async (req, res) => {
    const result = await authService.resendEmailOtp(req.body.email);
    return ok(res, result, 'Verification code sent');
  }),
);

router.post(
  '/forgot-password',
  authLimit,
  validate(authSchemas.forgotPassword),
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    return ok(res, result, 'If an account exists, a reset OTP has been sent');
  }),
);

router.post(
  '/reset-password',
  authLimit,
  validate(authSchemas.resetPassword),
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body);
    return ok(res, result, 'Password reset complete. Please sign in again.');
  }),
);

router.post(
  '/oauth',
  authLimit,
  validate(authSchemas.oauth),
  asyncHandler(async (req, res) => {
    const result = await authService.oauthLogin({
      provider: req.body.provider as AuthProvider,
      idToken: req.body.idToken,
      deviceId: req.body.deviceId,
      context: context(req),
    });
    return ok(res, result, `${req.body.provider} login successful`);
  }),
);

router.post(
  '/phone/start',
  authLimit,
  validate(authSchemas.phoneStart),
  asyncHandler(async (req, res) => {
    const result = await authService.startPhoneLogin(req.body.phone);
    return ok(res, result, 'SMS OTP sent');
  }),
);

router.post(
  '/phone/verify',
  authLimit,
  validate(authSchemas.phoneVerify),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyPhoneLogin({ ...req.body, context: context(req) });
    return ok(res, result, 'Phone login successful');
  }),
);

router.post(
  '/2fa/start',
  requireAuth,
  validate(authSchemas.twoFactorStart),
  asyncHandler(async (req, res) => {
    const result = await authService.startTwoFactor(req.user!.id);
    return ok(res, result, 'Scan the TOTP secret in your authenticator app');
  }),
);

router.post(
  '/2fa/verify',
  requireAuth,
  validate(authSchemas.twoFactorVerify),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyTwoFactor(req.user!.id, req.body.token);
    return ok(res, result, 'Two-factor authentication enabled');
  }),
);

router.get(
  '/devices',
  requireAuth,
  asyncHandler(async (req, res) => {
    const devices = await authService.listDevices(req.user!.id);
    return ok(res, devices, 'Device login history');
  }),
);

router.delete(
  '/devices/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.revokeDevice(req.user!.id, req.params.id);
    return ok(res, result, 'Device session revoked');
  }),
);

export { router as authRouter };
