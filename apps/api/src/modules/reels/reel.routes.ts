import { Router } from 'express';
import { z } from 'zod';
import { REEL_POLICY } from '@krazyverse/shared';
import { prisma } from '../../db/prisma';
import { ai } from '../../integrations/ai';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError, created, getPagination, ok } from '../../utils/http';

const router = Router();

const createReelSchema = z.object({
  caption: z.string().max(2200).optional(),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  durationMs: z.number().int().positive().optional(),
  audioUrl: z.string().url().optional(),
  sourceReelId: z.string().optional(),
  speed: z.number().min(REEL_POLICY.minSpeed).max(REEL_POLICY.maxSpeed).default(1),
  metadata: z.record(z.unknown()).optional(),
});

router.post(
  '/',
  requireAuth,
  validate(createReelSchema),
  asyncHandler(async (req, res) => {
    const subtitles = await ai.videoAssistant(`Generate subtitle suggestions for ${req.body.videoUrl}`).catch(
      () => null,
    );
    const reel = await prisma.reel.create({
      data: {
        authorId: req.user!.id,
        caption: req.body.caption,
        videoUrl: req.body.videoUrl,
        thumbnailUrl: req.body.thumbnailUrl,
        durationMs: req.body.durationMs,
        audioUrl: req.body.audioUrl,
        sourceReelId: req.body.sourceReelId,
        speed: req.body.speed,
        metadata: req.body.metadata,
        subtitles: subtitles ?? undefined,
      },
    });
    return created(res, reel, 'Reel published');
  }),
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { cursor, limit } = getPagination(req.query);
    const reels = await prisma.reel.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ createdAt: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: { include: { profile: true } },
        _count: { select: { likes: true, comments: true, saves: true, watches: true } },
      },
    });
    const nextCursor = reels.length > limit ? reels.at(-1)?.id : null;
    return ok(res, reels.slice(0, limit), 'Reels feed loaded', { cursor, nextCursor, limit });
  }),
);

router.post(
  '/:id/watch',
  requireAuth,
  validate(z.object({ watchMs: z.number().int().nonnegative(), completed: z.boolean().default(false) })),
  asyncHandler(async (req, res) => {
    const watch = await prisma.reelWatch.upsert({
      where: { userId_reelId: { userId: req.user!.id, reelId: req.params.id } },
      create: {
        userId: req.user!.id,
        reelId: req.params.id,
        watchMs: req.body.watchMs,
        completed: req.body.completed,
      },
      update: {
        watchMs: { increment: req.body.watchMs },
        completed: req.body.completed,
      },
    });
    return ok(res, watch, 'Watch history updated');
  }),
);

router.get(
  '/watch-history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const history = await prisma.reelWatch.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      include: { reel: { include: { author: { include: { profile: true } } } } },
      take: 100,
    });
    return ok(res, history, 'Watch history loaded');
  }),
);

router.post(
  '/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await prisma.like.findUnique({
      where: { userId_reelId: { userId: req.user!.id, reelId: req.params.id } },
    });
    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      return ok(res, { liked: false }, 'Reel unliked');
    }
    await prisma.like.create({ data: { userId: req.user!.id, reelId: req.params.id } });
    return ok(res, { liked: true }, 'Reel liked');
  }),
);

router.post(
  '/:id/comment',
  requireAuth,
  validate(z.object({ content: z.string().min(1).max(2200), parentId: z.string().optional() })),
  asyncHandler(async (req, res) => {
    let depth = 0;
    if (req.body.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: req.body.parentId } });
      if (!parent || parent.reelId !== req.params.id) {
        throw new ApiError(404, 'Parent comment not found', 'COMMENT_NOT_FOUND');
      }
      if (parent.depth >= 1) {
        throw new ApiError(422, 'Comment threads are limited to two levels', 'COMMENT_DEPTH_LIMIT');
      }
      depth = parent.depth + 1;
    }
    const comment = await prisma.comment.create({
      data: {
        authorId: req.user!.id,
        reelId: req.params.id,
        content: req.body.content,
        parentId: req.body.parentId,
        depth,
      },
    });
    return created(res, comment, 'Comment added');
  }),
);

router.post(
  '/:id/duet',
  requireAuth,
  validate(createReelSchema.omit({ sourceReelId: true })),
  asyncHandler(async (req, res) => {
    const reel = await prisma.reel.create({
      data: {
        ...req.body,
        authorId: req.user!.id,
        sourceReelId: req.params.id,
        metadata: { ...(req.body.metadata ?? {}), mode: 'duet' },
      },
    });
    return created(res, reel, 'Duet created');
  }),
);

export { router as reelRouter };
