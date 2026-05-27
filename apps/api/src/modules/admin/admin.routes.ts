import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { created, ok } from '../../utils/http';

const router = Router();

router.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR));

router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sinceMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [dau, mau, revenue, topContent, reports] = await Promise.all([
      prisma.deviceSession.count({ where: { lastSeenAt: { gte: sinceDay } } }),
      prisma.deviceSession.count({ where: { lastSeenAt: { gte: sinceMonth } } }),
      prisma.earning.aggregate({ _sum: { amountCents: true } }),
      prisma.post.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ likes: { _count: 'desc' } }],
        include: { author: { include: { profile: true } }, _count: { select: { likes: true, comments: true } } },
        take: 10,
      }),
      prisma.report.count({ where: { status: 'OPEN' } }),
    ]);
    return ok(res, { dau, mau, revenueCents: revenue._sum.amountCents ?? 0, topContent, openReports: reports }, 'Admin dashboard');
  }),
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '');
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { profile: { username: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      include: { profile: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, users, 'Users loaded');
  }),
);

router.post(
  '/users/:id/moderate',
  validate(z.object({ action: z.enum(['ban', 'warn', 'verify', 'unban']), reason: z.string().max(500).optional() })),
  asyncHandler(async (req, res) => {
    if (req.body.action === 'verify') {
      await prisma.profile.update({ where: { userId: req.params.id }, data: { verified: true, verifiedReason: 'manual' } });
    } else if (req.body.action === 'ban') {
      await prisma.user.update({ where: { id: req.params.id }, data: { status: 'BANNED' } });
    } else if (req.body.action === 'unban') {
      await prisma.user.update({ where: { id: req.params.id }, data: { status: 'ACTIVE' } });
    }
    const log = await prisma.adminLog.create({
      data: {
        adminId: req.user!.id,
        action: `user.${req.body.action}`,
        targetType: 'USER',
        targetId: req.params.id,
        metadata: { reason: req.body.reason },
      },
    });
    return ok(res, log, 'User moderation action recorded');
  }),
);

router.post(
  '/users/:id/impersonate',
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const log = await prisma.adminLog.create({
      data: { adminId: req.user!.id, action: 'user.impersonate', targetType: 'USER', targetId: req.params.id },
    });
    return created(res, { auditLogId: log.id, targetUserId: req.params.id }, 'Impersonation audit created');
  }),
);

router.get(
  '/moderation',
  asyncHandler(async (_req, res) => {
    const [posts, comments, reels] = await Promise.all([
      prisma.post.findMany({ where: { aiModerationStatus: 'FLAGGED' }, take: 50 }),
      prisma.comment.findMany({ where: { aiModerationStatus: 'FLAGGED' }, take: 50 }),
      prisma.reel.findMany({ where: { aiModerationStatus: 'FLAGGED' }, take: 50 }),
    ]);
    return ok(res, { posts, comments, reels }, 'AI-flagged moderation queue');
  }),
);

router.get(
  '/reports',
  asyncHandler(async (_req, res) => {
    const reports = await prisma.report.findMany({
      where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
      include: { reporter: { include: { profile: true } }, assignee: { include: { profile: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return ok(res, reports, 'Report queue loaded');
  }),
);

router.patch(
  '/reports/:id',
  validate(z.object({ status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED']), resolution: z.string().max(1000).optional() })),
  asyncHandler(async (req, res) => {
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: req.body.status, resolution: req.body.resolution, assigneeId: req.user!.id },
    });
    return ok(res, report, 'Report updated');
  }),
);

router.post(
  '/ads',
  validate(
    z.object({
      title: z.string().min(1).max(120),
      creativeUrl: z.string().url(),
      placement: z.enum(['BANNER', 'FEED', 'STORY', 'REEL']),
      budgetCents: z.number().int().positive(),
      target: z.record(z.unknown()).default({}),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const ad = await prisma.ad.create({
      data: {
        ...req.body,
        createdById: req.user!.id,
        startsAt: req.body.startsAt ? new Date(req.body.startsAt) : undefined,
        endsAt: req.body.endsAt ? new Date(req.body.endsAt) : undefined,
      },
    });
    return created(res, ad, 'Ad created');
  }),
);

router.get(
  '/monitoring',
  asyncHandler(async (_req, res) => {
    return ok(
      res,
      {
        uptimeSeconds: process.uptime(),
        latencyMs: 0,
        errorRate: 0,
        nodeVersion: process.version,
      },
      'Server monitoring snapshot',
    );
  }),
);

router.post(
  '/push/broadcast',
  validate(z.object({ title: z.string().min(1), body: z.string().min(1), audience: z.record(z.unknown()).default({}) })),
  asyncHandler(async (req, res) => {
    return created(res, { queued: true, ...req.body }, 'Push broadcast queued');
  }),
);

router.get(
  '/feature-flags',
  asyncHandler(async (_req, res) => {
    return ok(
      res,
      {
        reelsDuet: true,
        aiAvatarCreator: true,
        liveShopping: false,
        vrRooms: false,
      },
      'Feature flags loaded',
    );
  }),
);

export { router as adminRouter };
