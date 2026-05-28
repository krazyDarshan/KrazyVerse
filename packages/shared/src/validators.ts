import { z } from 'zod';
import { CHAT_LIMITS, POST_LIMITS, PROFILE_LIMITS } from './constants';

export const cuidSchema = z.string().min(8);

export const apiErrorSchema = z.object({
  code: z.string(),
  details: z.unknown().optional(),
});

export const paginatedMetaSchema = z.object({
  cursor: z.string().nullable().optional(),
  nextCursor: z.string().nullable().optional(),
  limit: z.number().int().positive().optional(),
  total: z.number().int().nonnegative().optional(),
});

export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  message: z.string().optional(),
  error: apiErrorSchema.optional(),
  meta: paginatedMetaSchema.optional(),
});

export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9._]+$/, 'Username can contain letters, numbers, dots, and underscores');

export const emailSchema = z.string().email().max(320);
export const passwordSchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number');

export const otpSchema = z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

const mediaUrlSchema = z.string().refine((value) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:', 'file:', 'content:', 'data:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}, 'Media URL must be a valid remote or local media URI');

export const authSchemas = {
  signup: z.object({
    email: emailSchema,
    password: passwordSchema,
    username: usernameSchema,
    displayName: z.string().min(1).max(80),
    deviceId: z.string().min(6).max(128),
  }),
  login: z.object({
    email: emailSchema,
    password: z.string().min(1).max(128),
    deviceId: z.string().min(6).max(128),
    totpCode: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
  }),
  refresh: z.object({
    refreshToken: z.string().min(20),
    deviceId: z.string().min(6).max(128),
  }),
  forgotPassword: z.object({
    email: emailSchema,
  }),
  resetPassword: z.object({
    email: emailSchema,
    otp: otpSchema,
    newPassword: passwordSchema,
  }),
  verifyOtp: z.object({
    email: emailSchema.optional(),
    phone: z.string().min(8).max(20).optional(),
    otp: otpSchema,
    purpose: z.enum(['EMAIL_VERIFY', 'PASSWORD_RESET', 'PHONE_LOGIN', 'TWO_FACTOR_SMS']),
  }),
  oauth: z.object({
    provider: z.enum(['GOOGLE', 'APPLE', 'CLERK', 'FIREBASE']),
    idToken: z.string().min(10),
    deviceId: z.string().min(6).max(128),
  }),
  phoneStart: z.object({
    phone: z.string().min(8).max(20),
  }),
  phoneVerify: z.object({
    phone: z.string().min(8).max(20),
    otp: otpSchema,
    deviceId: z.string().min(6).max(128),
  }),
  twoFactorStart: z.object({}),
  twoFactorVerify: z.object({
    token: z.string().regex(/^\d{6}$/),
  }),
};

export const profileSchemas = {
  update: z.object({
    username: usernameSchema.optional(),
    displayName: z.string().min(1).max(80).optional(),
    bio: z.string().max(PROFILE_LIMITS.bio).optional(),
    profilePictureUrl: z.string().url().optional().nullable(),
    coverPhotoUrl: z.string().url().optional().nullable(),
    websiteLinks: z.array(z.string().url()).max(PROFILE_LIMITS.websiteLinks).optional(),
    gender: z.string().max(40).optional().nullable(),
    pronouns: z.string().max(40).optional().nullable(),
    dateOfBirth: z.string().datetime().optional().nullable(),
    accountType: z.enum(['PUBLIC', 'PRIVATE']).optional(),
    profileMusicUrl: z.string().url().optional().nullable(),
    customTheme: z.record(z.unknown()).optional().nullable(),
  }),
};

export const mediaInputSchema = z.object({
  type: z.enum(['IMAGE', 'VIDEO']),
  url: mediaUrlSchema,
  thumbnailUrl: mediaUrlSchema.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  altText: z.string().max(500).optional(),
  order: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).optional(),
});

export const postSchemas = {
  create: z.object({
    caption: z.string().max(POST_LIMITS.caption).optional(),
    media: z.array(mediaInputSchema).min(1).max(POST_LIMITS.carouselMedia),
    hashtags: z.array(z.string().min(1).max(80)).max(POST_LIMITS.hashtags).optional(),
    locationId: z.string().optional(),
    taggedUserIds: z.array(z.string()).max(POST_LIMITS.taggedPeople).optional(),
    visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE']).default('PUBLIC'),
    scheduledAt: z.string().datetime().optional(),
    isPollEnabled: z.boolean().optional(),
    pollOptions: z.array(z.string().min(1).max(80)).min(2).max(4).optional(),
  }),
  update: z.object({
    caption: z.string().max(POST_LIMITS.caption).optional(),
    hashtags: z.array(z.string().min(1).max(80)).max(POST_LIMITS.hashtags).optional(),
    taggedUserIds: z.array(z.string()).max(POST_LIMITS.taggedPeople).optional(),
    locationId: z.string().optional().nullable(),
  }),
  draft: z.object({
    id: z.string().optional(),
    payload: z.record(z.unknown()),
  }),
};

export const commentSchemas = {
  create: z.object({
    postId: z.string(),
    content: z.string().min(1).max(2200),
    parentId: z.string().optional(),
  }),
};

export const storySchemas = {
  create: z.object({
    text: z.string().max(1000).optional(),
    media: z.array(mediaInputSchema).max(10).optional(),
    stickers: z.array(z.record(z.unknown())).optional(),
    music: z.record(z.unknown()).optional(),
    mentionedUserIds: z.array(z.string()).max(20).optional(),
    hideFromUserIds: z.array(z.string()).optional(),
    closeFriendsOnly: z.boolean().default(false),
  }),
};

export const messageSchemas = {
  send: z.object({
    conversationId: z.string(),
    content: z.string().max(5000).optional(),
    mediaUrls: z.array(z.string().url()).max(10).optional(),
    replyToMessageId: z.string().optional(),
    clientId: z.string().min(4),
  }),
  createConversation: z.object({
    memberIds: z
      .array(z.string())
      .min(1)
      .max(CHAT_LIMITS.groupMembers - 1),
    title: z.string().max(120).optional(),
    isGroup: z.boolean().default(false),
  }),
};

export const reportSchema = z.object({
  targetType: z.enum(['USER', 'POST', 'COMMENT', 'STORY', 'REEL', 'MESSAGE']),
  targetId: z.string(),
  reason: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
});

export const publicProfileSchema = z.object({
  id: z.string(),
  username: usernameSchema,
  displayName: z.string(),
  bio: z.string().nullable().optional(),
  profilePictureUrl: z.string().nullable().optional(),
  verified: z.boolean(),
  followersCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
});
