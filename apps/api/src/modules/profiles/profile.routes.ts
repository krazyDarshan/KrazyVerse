import { Router } from 'express';
import { z } from 'zod';
import { FollowRequestStatus } from '@prisma/client';
import { profileSchemas } from '@krazyverse/shared';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError, created, ok } from '../../utils/http';
import { createNotification } from '../notifications/notification.service';

const router = Router();

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: { email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true },
        },
      },
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
              include: {
                media: { orderBy: { order: 'asc' } },
                _count: { select: { likes: true, comments: true } },
              },
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
    await prisma.profile.update({
      where: { id: profile.id },
      data: { profileViews: { increment: 1 } },
    });
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

    const targetProfile = await prisma.profile.findUniqueOrThrow({
      where: { userId: req.params.userId },
    });
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: req.user!.id, followingId: req.params.userId },
      },
    });
    if (existingFollow) {
      return ok(
        res,
        { following: true, requested: false, followId: existingFollow.id },
        'Already following',
      );
    }

    if (targetProfile.accountType === 'PRIVATE') {
      const request = await prisma.followRequest.upsert({
        where: { requesterId_targetId: { requesterId: req.user!.id, targetId: req.params.userId } },
        create: { requesterId: req.user!.id, targetId: req.params.userId },
        update: { status: FollowRequestStatus.PENDING },
      });
      await createNotification({
        recipientId: req.params.userId,
        actorId: req.user!.id,
        kind: 'FOLLOW_REQUEST',
        title: 'New follow request',
        body: 'Someone requested to follow you.',
        entityType: 'USER',
        entityId: req.user!.id,
      });
      return created(
        res,
        { following: false, requested: true, requestId: request.id },
        'Follow request sent',
      );
    }

    const follow = await prisma.$transaction(async (tx) => {
      const createdFollow = await tx.follow.create({
        data: { followerId: req.user!.id, followingId: req.params.userId },
      });
      await tx.profile.update({
        where: { userId: req.user!.id },
        data: { followingCount: { increment: 1 } },
      });
      await tx.profile.update({
        where: { userId: req.params.userId },
        data: { followersCount: { increment: 1 } },
      });
      return createdFollow;
    });

    await createNotification({
      recipientId: req.params.userId,
      actorId: req.user!.id,
      kind: 'FOLLOW',
      title: 'New follower',
      body: 'Someone started following you.',
      entityType: 'USER',
      entityId: req.user!.id,
    });

    return ok(res, { following: true, requested: false, followId: follow.id }, 'Now following');
  }),
);

router.delete(
  '/:userId/follow',
  requireAuth,
  asyncHandler(async (req, res) => {
    const deletedFollow = await prisma.follow.deleteMany({
      where: { followerId: req.user!.id, followingId: req.params.userId },
    });
    const deletedRequest = await prisma.followRequest.deleteMany({
      where: { requesterId: req.user!.id, targetId: req.params.userId },
    });

    if (deletedFollow.count > 0) {
      await prisma.$transaction([
        prisma.profile.updateMany({
          where: { userId: req.user!.id, followingCount: { gt: 0 } },
          data: { followingCount: { decrement: 1 } },
        }),
        prisma.profile.updateMany({
          where: { userId: req.params.userId, followersCount: { gt: 0 } },
          data: { followersCount: { decrement: 1 } },
        }),
      ]);
    }

    return ok(
      res,
      {
        following: false,
        requested: false,
        removedFollow: deletedFollow.count > 0,
        removedRequest: deletedRequest.count > 0,
      },
      'Unfollowed',
    );
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
      const existingFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: request.requesterId,
            followingId: request.targetId,
          },
        },
      });
      await prisma.$transaction(async (tx) => {
        if (!existingFollow) {
          await tx.follow.create({
            data: { followerId: request.requesterId, followingId: request.targetId },
          });
          await tx.profile.update({
            where: { userId: request.requesterId },
            data: { followingCount: { increment: 1 } },
          });
          await tx.profile.update({
            where: { userId: request.targetId },
            data: { followersCount: { increment: 1 } },
          });
        }
        await tx.followRequest.update({
          where: { id: request.id },
          data: { status: FollowRequestStatus.ACCEPTED },
        });
      });
      await createNotification({
        recipientId: request.requesterId,
        actorId: request.targetId,
        kind: 'FOLLOW',
        title: 'Follow request accepted',
        body: 'Your follow request was accepted.',
        entityType: 'USER',
        entityId: request.targetId,
      });
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
