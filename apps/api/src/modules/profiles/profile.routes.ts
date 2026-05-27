import { Router } from 'express';
import { z } from 'zod';
import { FollowRequestStatus } from '@prisma/client';
import { profileSchemas } from '@krazyverse/shared';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError, created, ok } from '../../utils/http';

const router = Router();

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { userId: req.user!.id },
      include: { user: { select: { email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true } } },
    });
    return ok(res, profile, 'Profile loaded');
  }),
);

router.patch(
  '/me',
  requireAuth,
  validate(profileSchemas.update),
  asyncHandler(async (req, res) => {
    const profile = await prisma.profile.update({
      where: { userId: req.user!.id },
      data: {
        ...req.body,
        username: req.body.username?.toLowerCase(),
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined,
      },
    });
    return ok(res, profile, 'Profile updated');
  }),
);

router.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const profile = await prisma.profile.findUnique({
      where: { username: req.params.username.toLowerCase() },
      include: {
        user: {
          select: {
            id: true,
            createdAt: true,
            posts: {
              where: { status: 'PUBLISHED' },
              orderBy: { publishedAt: 'desc' },
              take: 18,
              include: { media: { orderBy: { order: 'asc' } }, _count: { select: { likes: true, comments: true } } },
            },
            storyHighlights: { include: { stories: true } },
            userBadges: { include: { badge: true } },
            streak: true,
          },
        },
      },
    });
    if (!profile) {
      throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
    }
    await prisma.profile.update({ where: { id: profile.id }, data: { profileViews: { increment: 1 } } });
    return ok(res, profile, 'Profile loaded');
  }),
);

router.post(
  '/:userId/follow',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.params.userId === req.user!.id) {
      throw new ApiError(422, 'You cannot follow yourself', 'SELF_FOLLOW');
    }

    const targetProfile = await prisma.profile.findUniqueOrThrow({ where: { userId: req.params.userId } });
    if (targetProfile.accountType === 'PRIVATE') {
      const request = await prisma.followRequest.upsert({
        where: { requesterId_targetId: { requesterId: req.user!.id, targetId: req.params.userId } },
        create: { requesterId: req.user!.id, targetId: req.params.userId },
        update: { status: FollowRequestStatus.PENDING },
      });
      return created(res, request, 'Follow request sent');
    }

    const follow = await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.user!.id, followingId: req.params.userId } },
      create: { followerId: req.user!.id, followingId: req.params.userId },
      update: {},
    });

    await prisma.$transaction([
      prisma.profile.update({ where: { userId: req.user!.id }, data: { followingCount: { increment: 1 } } }),
      prisma.profile.update({ where: { userId: req.params.userId }, data: { followersCount: { increment: 1 } } }),
    ]).catch(() => undefined);

    return ok(res, follow, 'Now following');
  }),
);

router.delete(
  '/:userId/follow',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.follow.deleteMany({
      where: { followerId: req.user!.id, followingId: req.params.userId },
    });
    await prisma.followRequest.deleteMany({
      where: { requesterId: req.user!.id, targetId: req.params.userId },
    });
    return ok(res, { following: false }, 'Unfollowed');
  }),
);

router.get(
  '/me/follow-requests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const requests = await prisma.followRequest.findMany({
      where: { targetId: req.user!.id, status: FollowRequestStatus.PENDING },
      include: { requester: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, requests, 'Follow requests loaded');
  }),
);

router.post(
  '/follow-requests/:id/respond',
  requireAuth,
  validate(z.object({ action: z.enum(['accept', 'decline']) })),
  asyncHandler(async (req, res) => {
    const request = await prisma.followRequest.findFirstOrThrow({
      where: { id: req.params.id, targetId: req.user!.id },
    });

    if (req.body.action === 'accept') {
      await prisma.$transaction([
        prisma.follow.create({
          data: { followerId: request.requesterId, followingId: request.targetId },
        }),
        prisma.followRequest.update({
          where: { id: request.id },
          data: { status: FollowRequestStatus.ACCEPTED },
        }),
      ]);
      return ok(res, { accepted: true }, 'Follow request accepted');
    }

    await prisma.followRequest.update({
      where: { id: request.id },
      data: { status: FollowRequestStatus.DECLINED },
    });
    return ok(res, { accepted: false }, 'Follow request declined');
  }),
);

router.get(
  '/:userId/followers',
  asyncHandler(async (req, res) => {
    const followers = await prisma.follow.findMany({
      where: { followingId: req.params.userId },
      include: { follower: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return ok(res, followers, 'Followers loaded');
  }),
);

router.get(
  '/:userId/following',
  asyncHandler(async (req, res) => {
    const following = await prisma.follow.findMany({
      where: { followerId: req.params.userId },
      include: { following: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return ok(res, following, 'Following loaded');
  }),
);

router.get(
  '/me/analytics',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [profile, posts, views] = await Promise.all([
      prisma.profile.findUniqueOrThrow({ where: { userId: req.user!.id } }),
      prisma.post.count({ where: { authorId: req.user!.id, status: 'PUBLISHED' } }),
      prisma.storyView.count({ where: { story: { authorId: req.user!.id } } }),
    ]);
    return ok(
      res,
      {
        profileViews: profile.profileViews,
        reach: profile.reach,
        followersCount: profile.followersCount,
        followingCount: profile.followingCount,
        posts,
        storyViews: views,
      },
      'Profile analytics loaded',
    );
  }),
);

export { router as profileRouter };
