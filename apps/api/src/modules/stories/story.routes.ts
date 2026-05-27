import { Router } from 'express';
import { z } from 'zod';
import { STORY_POLICY, STORY_REACTIONS, storySchemas } from '@krazyverse/shared';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError, created, ok } from '../../utils/http';

const router = Router();

router.post(
  '/',
  requireAuth,
  validate(storySchemas.create),
  asyncHandler(async (req, res) => {
    const expiresAt = new Date(Date.now() + STORY_POLICY.expiresHours * 60 * 60 * 1000);
    const story = await prisma.story.create({
      data: {
        authorId: req.user!.id,
        text: req.body.text,
        stickers: req.body.stickers,
        music: req.body.music,
        hideFromUserIds: req.body.hideFromUserIds ?? [],
        closeFriendsOnly: req.body.closeFriendsOnly,
        expiresAt,
        media: {
          create:
            req.body.media?.map((media: any, order: number) => ({
              type: media.type,
              url: media.url,
              thumbnailUrl: media.thumbnailUrl,
              durationMs: media.durationMs,
              metadata: media.metadata,
              order,
            })) ?? [],
        },
      },
      include: { media: true },
    });
    return created(res, story, 'Story published');
  }),
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const following = await prisma.follow.findMany({
      where: { followerId: req.user!.id },
      select: { followingId: true },
    });
    const authorIds = [...following.map((item) => item.followingId), req.user!.id];
    const stories = await prisma.story.findMany({
      where: {
        authorId: { in: authorIds },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: { media: true, author: { include: { profile: true } }, _count: { select: { views: true } } },
    });
    return ok(res, stories, 'Stories loaded');
  }),
);

router.post(
  '/:id/view',
  requireAuth,
  asyncHandler(async (req, res) => {
    const story = await prisma.story.findUniqueOrThrow({ where: { id: req.params.id } });
    if (story.expiresAt < new Date()) {
      throw new ApiError(410, 'Story has expired', 'STORY_EXPIRED');
    }
    const view = await prisma.storyView.upsert({
      where: { storyId_viewerId: { storyId: req.params.id, viewerId: req.user!.id } },
      create: { storyId: req.params.id, viewerId: req.user!.id },
      update: {},
    });
    return ok(res, view, 'Story view recorded');
  }),
);

router.get(
  '/:id/viewers',
  requireAuth,
  asyncHandler(async (req, res) => {
    const story = await prisma.story.findFirstOrThrow({
      where: { id: req.params.id, authorId: req.user!.id },
    });
    const closeFriendIds = (
      await prisma.closeFriend.findMany({ where: { ownerId: req.user!.id }, select: { friendId: true } })
    ).map((friend) => friend.friendId);
    const viewers = await prisma.storyView.findMany({
      where: { storyId: story.id },
      include: { viewer: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
    viewers.sort((a, b) => Number(closeFriendIds.includes(b.viewerId)) - Number(closeFriendIds.includes(a.viewerId)));
    return ok(res, viewers, 'Story viewers loaded');
  }),
);

router.post(
  '/:id/react',
  requireAuth,
  validate(z.object({ emoji: z.enum(STORY_REACTIONS) })),
  asyncHandler(async (req, res) => {
    const reaction = await prisma.reaction.create({
      data: { userId: req.user!.id, storyId: req.params.id, emoji: req.body.emoji },
    });
    return created(res, reaction, 'Story reaction sent');
  }),
);

router.post(
  '/:id/reply',
  requireAuth,
  validate(z.object({ text: z.string().min(1).max(1000) })),
  asyncHandler(async (req, res) => {
    const story = await prisma.story.findUniqueOrThrow({ where: { id: req.params.id } });
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: false,
        members: {
          create: [
            { userId: req.user!.id },
            { userId: story.authorId },
          ],
        },
        messages: {
          create: {
            senderId: req.user!.id,
            content: req.body.text,
            media: { storyId: story.id },
          },
        },
      },
      include: { messages: true },
    });
    return created(res, conversation, 'Story reply sent to DM');
  }),
);

router.post(
  '/highlights',
  requireAuth,
  validate(z.object({ title: z.string().min(1).max(80), storyIds: z.array(z.string()).min(1), coverUrl: z.string().url().optional() })),
  asyncHandler(async (req, res) => {
    const highlight = await prisma.storyHighlight.create({
      data: {
        ownerId: req.user!.id,
        title: req.body.title,
        coverUrl: req.body.coverUrl,
        stories: {
          create: req.body.storyIds.map((storyId: string, order: number) => ({ storyId, order })),
        },
      },
      include: { stories: true },
    });
    return created(res, highlight, 'Highlight created');
  }),
);

export { router as storyRouter };
