import { AuthProvider, OtpPurpose, UserRole, type User } from '@prisma/client';
import speakeasy from 'speakeasy';
import { OTP_POLICY } from '@krazyverse/shared';
import { prisma } from '../../db/prisma';
import { sendOtpEmail, sendSuspiciousLoginEmail } from '../../integrations/email';
import { sendSmsOtp, verifyTwilioOtp } from '../../integrations/sms';
import { ApiError } from '../../utils/http';
import {
  addMinutes,
  addSeconds,
  generateOtp,
  hashOpaqueToken,
  hashSecret,
  newOpaqueToken,
  verifySecret,
} from '../../utils/security';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/tokens';
import { env } from '../../config/env';

type RequestContext = {
  ip?: string;
  userAgent?: string;
};

type IssueTokensInput = {
  user: Pick<User, 'id' | 'role' | 'email'>;
  deviceId: string;
  context: RequestContext;
};

function safeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    twoFactorEnabled: user.twoFactorEnabled,
    profile: user.profile,
  };
}

export function normalizeUsernameSeed(seed: string) {
  return seed
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 24)
    .padEnd(3, 'x');
}

export async function issueTokens({ user, deviceId, context }: IssueTokensInput) {
  const tokenId = newOpaqueToken('rt');
  const accessToken = signAccessToken({ sub: user.id, role: user.role, deviceId });
  const refreshToken = signRefreshToken({ sub: user.id, deviceId, tokenId });
  const refreshTokenHash = hashOpaqueToken(refreshToken);

  const existingSession = await prisma.deviceSession.findUnique({
    where: { userId_deviceId: { userId: user.id, deviceId } },
  });
  const suspicious = !existingSession;

  await prisma.deviceSession.upsert({
    where: { userId_deviceId: { userId: user.id, deviceId } },
    create: {
      userId: user.id,
      deviceId,
      ip: context.ip,
      userAgent: context.userAgent,
      refreshTokenHash,
      suspicious,
      trusted: !suspicious,
    },
    update: {
      ip: context.ip,
      userAgent: context.userAgent,
      refreshTokenHash,
      revokedAt: null,
      suspicious,
      lastSeenAt: new Date(),
    },
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  if (suspicious && user.email) {
    await sendSuspiciousLoginEmail(user.email, context);
  }

  return { accessToken, refreshToken, tokenType: 'Bearer' as const };
}

async function createOtp(input: {
  userId?: string;
  email?: string;
  phone?: string;
  purpose: OtpPurpose;
}) {
  const code = generateOtp();
  await prisma.authOtp.create({
    data: {
      userId: input.userId,
      email: input.email,
      phone: input.phone,
      purpose: input.purpose,
      codeHash: await hashSecret(code),
      expiresAt: addMinutes(new Date(), OTP_POLICY.expiryMinutes),
      resendAfter: addSeconds(new Date(), OTP_POLICY.resendSeconds),
    },
  });
  return code;
}

async function consumeOtp(input: { email?: string; phone?: string; purpose: OtpPurpose; otp: string }) {
  const record = await prisma.authOtp.findFirst({
    where: {
      email: input.email,
      phone: input.phone,
      purpose: input.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new ApiError(400, 'OTP is invalid or expired', 'INVALID_OTP');
  }

  const valid = await verifySecret(input.otp, record.codeHash);
  if (!valid) {
    await prisma.authOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(400, 'OTP is invalid or expired', 'INVALID_OTP');
  }

  await prisma.authOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return record;
}

export const authService = {
  async signup(input: {
    email: string;
    password: string;
    username: string;
    displayName: string;
    deviceId: string;
    context: RequestContext;
  }) {
    const passwordHash = await hashSecret(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role: UserRole.USER,
        profile: {
          create: {
            username: input.username.toLowerCase(),
            displayName: input.displayName,
          },
        },
        streak: { create: {} },
      },
      include: { profile: true },
    });

    const otp = await createOtp({
      userId: user.id,
      email: user.email ?? undefined,
      purpose: OtpPurpose.EMAIL_VERIFY,
    });
    await sendOtpEmail(input.email, otp, OtpPurpose.EMAIL_VERIFY);

    const tokens = await issueTokens({ user, deviceId: input.deviceId, context: input.context });
    return {
      user: safeUser(user),
      tokens,
      devOtp: env.NODE_ENV === 'production' ? undefined : otp,
    };
  },

  async login(input: {
    email: string;
    password: string;
    deviceId: string;
    totpCode?: string;
    context: RequestContext;
  }) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { profile: true },
    });

    if (!user?.passwordHash || !(await verifySecret(input.password, user.passwordHash))) {
      throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new ApiError(403, 'Account is not active', 'ACCOUNT_INACTIVE');
    }

    if (user.twoFactorEnabled) {
      if (!input.totpCode || !user.twoFactorSecret) {
        throw new ApiError(428, 'Two-factor authentication code required', 'TWO_FACTOR_REQUIRED');
      }
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: input.totpCode,
        window: 1,
      });
      if (!verified) {
        throw new ApiError(401, 'Invalid two-factor authentication code', 'INVALID_TWO_FACTOR_CODE');
      }
    }

    const tokens = await issueTokens({ user, deviceId: input.deviceId, context: input.context });
    return { user: safeUser(user), tokens };
  },

  async refresh(refreshToken: string, deviceId: string, context: RequestContext) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload.deviceId !== deviceId) {
      throw new ApiError(401, 'Refresh token device mismatch', 'INVALID_REFRESH_TOKEN');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { profile: true } });
    if (!user || user.status !== 'ACTIVE') {
      throw new ApiError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const session = await prisma.deviceSession.findUnique({
      where: { userId_deviceId: { userId: user.id, deviceId } },
    });

    if (!session || session.revokedAt || session.refreshTokenHash !== hashOpaqueToken(refreshToken)) {
      throw new ApiError(401, 'Refresh token has been revoked', 'REFRESH_REVOKED');
    }

    const tokens = await issueTokens({ user, deviceId, context });
    return { user: safeUser(user), tokens };
  },

  async logout(userId: string, deviceId: string) {
    await prisma.deviceSession.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  },

  async verifyOtp(input: {
    email?: string;
    phone?: string;
    otp: string;
    purpose: OtpPurpose;
  }) {
    const record = await consumeOtp(input);

    if (input.purpose === OtpPurpose.EMAIL_VERIFY && record.email) {
      await prisma.user.updateMany({
        where: { email: record.email },
        data: { emailVerifiedAt: new Date() },
      });
    }

    if (input.purpose === OtpPurpose.PHONE_LOGIN && record.phone) {
      await prisma.user.updateMany({
        where: { phone: record.phone },
        data: { phoneVerifiedAt: new Date() },
      });
    }

    return { verified: true };
  },

  async resendEmailOtp(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return { sent: true };
    }

    const latest = await prisma.authOtp.findFirst({
      where: { email: user.email, purpose: OtpPurpose.EMAIL_VERIFY, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && latest.resendAfter > new Date()) {
      throw new ApiError(429, 'Please wait before requesting another OTP', 'OTP_RESEND_WAIT');
    }

    const otp = await createOtp({ userId: user.id, email: user.email ?? undefined, purpose: OtpPurpose.EMAIL_VERIFY });
    await sendOtpEmail(email, otp, OtpPurpose.EMAIL_VERIFY);
    return { sent: true, devOtp: env.NODE_ENV === 'production' ? undefined : otp };
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return { sent: true };
    }

    const otp = await createOtp({
      userId: user.id,
      email: user.email ?? undefined,
      purpose: OtpPurpose.PASSWORD_RESET,
    });
    await sendOtpEmail(email, otp, OtpPurpose.PASSWORD_RESET);
    return { sent: true, devOtp: env.NODE_ENV === 'production' ? undefined : otp };
  },

  async resetPassword(input: { email: string; otp: string; newPassword: string }) {
    await consumeOtp({
      email: input.email.toLowerCase(),
      otp: input.otp,
      purpose: OtpPurpose.PASSWORD_RESET,
    });
    await prisma.user.update({
      where: { email: input.email.toLowerCase() },
      data: { passwordHash: await hashSecret(input.newPassword) },
    });
    await prisma.deviceSession.updateMany({
      where: { user: { email: input.email.toLowerCase() } },
      data: { revokedAt: new Date() },
    });
    return { reset: true };
  },

  async startPhoneLogin(phone: string) {
    const otp = await createOtp({ phone, purpose: OtpPurpose.PHONE_LOGIN });
    await sendSmsOtp(phone, otp);
    return { sent: true, devOtp: env.NODE_ENV === 'production' ? undefined : otp };
  },

  async verifyPhoneLogin(input: { phone: string; otp: string; deviceId: string; context: RequestContext }) {
    const twilioApproved = await verifyTwilioOtp(input.phone, input.otp);
    if (!twilioApproved) {
      throw new ApiError(400, 'OTP is invalid or expired', 'INVALID_OTP');
    }
    await consumeOtp({ phone: input.phone, otp: input.otp, purpose: OtpPurpose.PHONE_LOGIN });

    const username = normalizeUsernameSeed(`kv${input.phone.slice(-8)}`);
    const user = await prisma.user.upsert({
      where: { phone: input.phone },
      create: {
        phone: input.phone,
        phoneVerifiedAt: new Date(),
        profile: {
          create: {
            username: `${username}.${Math.floor(Math.random() * 9999)}`,
            displayName: 'KrazyVerse User',
          },
        },
        streak: { create: {} },
      },
      update: { phoneVerifiedAt: new Date() },
      include: { profile: true },
    });

    const tokens = await issueTokens({ user, deviceId: input.deviceId, context: input.context });
    return { user: safeUser(user), tokens };
  },

  async oauthLogin(input: {
    provider: AuthProvider;
    idToken: string;
    deviceId: string;
    context: RequestContext;
  }) {
    const tokenFingerprint = hashOpaqueToken(input.idToken);
    const providerAccountId = `${input.provider.toLowerCase()}_${tokenFingerprint.slice(0, 24)}`;
    const email = input.idToken.includes('@') ? input.idToken.toLowerCase() : undefined;

    const existing = await prisma.externalAccount.findUnique({
      where: { provider_providerAccountId: { provider: input.provider, providerAccountId } },
      include: { user: { include: { profile: true } } },
    });

    const user =
      existing?.user ??
      (await prisma.user.create({
        data: {
          email,
          emailVerifiedAt: email ? new Date() : undefined,
          externalAccounts: {
            create: {
              provider: input.provider,
              providerAccountId,
              email,
              metadata: { verifiedBy: input.provider },
            },
          },
          profile: {
            create: {
              username: `${normalizeUsernameSeed(email?.split('@')[0] ?? providerAccountId)}.${Math.floor(
                Math.random() * 9999,
              )}`,
              displayName: email?.split('@')[0] ?? 'KrazyVerse User',
            },
          },
          streak: { create: {} },
        },
        include: { profile: true },
      }));

    const tokens = await issueTokens({ user, deviceId: input.deviceId, context: input.context });
    return { user: safeUser(user), tokens };
  },

  async startTwoFactor(userId: string) {
    const secret = speakeasy.generateSecret({ name: 'KrazyVerse', issuer: 'KrazyVerse' });
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret.base32 } });
    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  },

  async verifyTwoFactor(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) {
      throw new ApiError(400, 'Two-factor setup has not been started', 'TWO_FACTOR_NOT_STARTED');
    }
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!verified) {
      throw new ApiError(400, 'Invalid two-factor code', 'INVALID_TWO_FACTOR_CODE');
    }
    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { enabled: true };
  },

  async listDevices(userId: string) {
    return prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        ip: true,
        userAgent: true,
        trusted: true,
        suspicious: true,
        revokedAt: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  },

  async revokeDevice(userId: string, deviceSessionId: string) {
    await prisma.deviceSession.updateMany({
      where: { id: deviceSessionId, userId },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  },
};
