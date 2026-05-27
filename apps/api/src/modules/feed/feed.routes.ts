import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { validateMany } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { getPagination, ok } from '../../utils/http';

const router = Router();

const feedQuerySchema = z.object({
  mode: z.enum(['following', 'recommended', 'trending']).default('recommended'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get(
  '/',
  optionalAuth,
  validateMany({ query: feedQuerySchema }),
  asyncHandler(async (req, res) => {
    const { mode, cursor, limit } = req.query as unknown as z.infer<typeof feedQuerySchema>;
    const baseWhere = { status: 'PUBLISHED' as const, publishedAt: { not: null } };

    const followingIds =
      mode === 'following' && req.user
        ? (
            await prisma.follow.findMany({
              where: { followerId: req.user.id },
              select: { followingId: true },
            })
          ).map((follow) => follow.followingId)
        : [];

    const where =
      mode === 'following' && req.user
        ? { ...baseWhere, authorId: { in: followingIds } }
        : mode === 'trending'
          ? { ...baseWhere, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
          : baseWhere;

    const posts = await prisma.post.findMany({
      where,
      orderBy: mode === 'trending' ? [{ likes: { _count: 'desc' } }, { publishedAt: 'desc' }] : { publishedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: { include: { profile: true } },
        media: { orderBy: { order: 'asc' } },
        hashtags: { include: { hashtag: true } },
        _count: { select: { likes: true, comments: true, saves: true } },
      },
    });

    const nextCursor = posts.length > limit ? posts.at(-1)?.id : null;
    return ok(res, posts.slice(0, limit), 'Feed loaded', { cursor, nextCursor, limit, mode });
  }),
);

router.get(
  '/bookmarks',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { cursor, limit } = getPagination(req.query);
    const saves = await prisma.save.findMany({
      where: { userId: req.user!.id, postId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { post: { include: { media: true, author: { include: { profile: true } } } } },
    });
    const nextCursor = saves.length > limit ? saves.at(-1)?.id : null;
    return ok(res, saves.slice(0, limit), 'Saved posts loaded', { cursor, nextCursor, limit });
  }),
);

router.get(
  '/trending-hashtags',
  asyncHandler(async (_req, res) => {
    const hashtags = await prisma.hashtag.findMany({
      orderBy: { useCount: 'desc' },
      take: 20,
    });
    return ok(res, hashtags, 'Trending hashtags loaded');
  }),
);

export { router as feedRouter };
