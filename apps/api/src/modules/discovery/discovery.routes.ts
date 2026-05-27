import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { searchDocuments } from '../../integrations/search';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { created, ok } from '../../utils/http';

const router = Router();

router.get(
  '/search',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const type = String(req.query.type ?? 'all');
    if (q.length < 2) {
      return ok(res, { users: [], posts: [], hashtags: [], locations: [], audio: [] }, 'Search results');
    }

    const [users, posts, hashtags, locations] = await Promise.all([
      type === 'all' || type === 'users'
        ? prisma.profile.findMany({
            where: {
              OR: [
                { username: { contains: q, mode: 'insensitive' } },
                { displayName: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: 20,
          })
        : [],
      type === 'all' || type === 'posts'
        ? prisma.post.findMany({
            where: { caption: { contains: q, mode: 'insensitive' }, status: 'PUBLISHED' },
            include: { media: true, author: { include: { profile: true } } },
            take: 20,
          })
        : [],
      type === 'all' || type === 'hashtags'
        ? prisma.hashtag.findMany({ where: { tag: { contains: q, mode: 'insensitive' } }, take: 20 })
        : [],
      type === 'all' || type === 'locations'
        ? prisma.location.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 20 })
        : [],
    ]);

    const fallback = users.length + posts.length + hashtags.length + locations.length === 0 ? await searchDocuments('posts', q) : [];
    return ok(res, { users, posts, hashtags, locations, audio: [], fallback }, 'Search results');
  }),
);

router.get(
  '/explore',
  optionalAuth,
  asyncHandler(async (_req, res) => {
    const posts = await prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }],
      include: { media: true, author: { include: { profile: true } }, _count: { select: { likes: true, comments: true } } },
      take: 60,
    });
    return ok(res, posts, 'Explore grid loaded');
  }),
);

router.get(
  '/suggested-users',
  requireAuth,
  asyncHandler(async (req, res) => {
    const followingIds = (
      await prisma.follow.findMany({ where: { followerId: req.user!.id }, select: { followingId: true } })
    ).map((follow) => follow.followingId);
    const suggestions = await prisma.profile.findMany({
      where: {
        userId: { notIn: [req.user!.id, ...followingIds] },
        user: { status: 'ACTIVE' },
      },
      orderBy: [{ verified: 'desc' }, { followersCount: 'desc' }],
      take: 20,
    });
    return ok(res, suggestions, 'Suggested users loaded');
  }),
);

router.post(
  '/close-friends/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const friend = await prisma.closeFriend.upsert({
      where: { ownerId_friendId: { ownerId: req.user!.id, friendId: req.params.userId } },
      create: { ownerId: req.user!.id, friendId: req.params.userId },
      update: {},
    });
    return created(res, friend, 'Added to close friends');
  }),
);

router.delete(
  '/close-friends/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.closeFriend.deleteMany({ where: { ownerId: req.user!.id, friendId: req.params.userId } });
    return ok(res, { removed: true }, 'Removed from close friends');
  }),
);

router.post(
  '/blocks/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const block = await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: req.user!.id, blockedId: req.params.userId } },
      create: { blockerId: req.user!.id, blockedId: req.params.userId },
      update: {},
    });
    return created(res, block, 'User blocked');
  }),
);

router.post(
  '/mutes/:userId',
  requireAuth,
  validate(z.object({ scope: z.enum(['POSTS', 'STORIES', 'MESSAGES', 'ALL']).default('ALL'), expiresAt: z.string().datetime().optional() })),
  asyncHandler(async (req, res) => {
    const mute = await prisma.mute.upsert({
      where: { muterId_mutedId_scope: { muterId: req.user!.id, mutedId: req.params.userId, scope: req.body.scope } },
      create: {
        muterId: req.user!.id,
        mutedId: req.params.userId,
        scope: req.body.scope,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      },
      update: { expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined },
    });
    return created(res, mute, 'User muted');
  }),
);

router.get(
  '/notifications',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return ok(res, notifications, 'Notifications loaded');
  }),
);

router.post(
  '/notifications/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.updateMany({
      where: { id: req.params.id, recipientId: req.user!.id },
      data: { readAt: new Date() },
    });
    return ok(res, notification, 'Notification marked read');
  }),
);

export { router as discoveryRouter };
