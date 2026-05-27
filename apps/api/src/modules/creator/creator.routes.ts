import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { created, ok } from '../../utils/http';

const router = Router();

router.post(
  '/apply',
  requireAuth,
  validate(z.object({ category: z.string().min(2).max(80).optional() })),
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, category: req.body.category },
      update: { category: req.body.category },
    });
    return created(res, creator, 'Creator dashboard enabled');
  }),
);

router.get(
  '/dashboard',
  requireAuth,
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.findUniqueOrThrow({
      where: { userId: req.user!.id },
      include: { earnings: true, products: true },
    });
    const [posts, followers, topPosts] = await Promise.all([
      prisma.post.count({ where: { authorId: req.user!.id, status: 'PUBLISHED' } }),
      prisma.follow.count({ where: { followingId: req.user!.id } }),
      prisma.post.findMany({
        where: { authorId: req.user!.id, status: 'PUBLISHED' },
        orderBy: [{ likes: { _count: 'desc' } }],
        include: { _count: { select: { likes: true, comments: true, saves: true } } },
        take: 5,
      }),
    ]);
    const earningsCents = creator.earnings.reduce((sum, earning) => sum + earning.amountCents, 0);
    return ok(
      res,
      {
        reach: creator.analytics,
        impressions: creator.analytics,
        profileVisits: creator.analytics,
        followerGrowth: followers,
        audienceDemographics: creator.analytics,
        posts,
        topPosts,
        earningsCents,
        products: creator.products,
      },
      'Creator dashboard loaded',
    );
  }),
);

router.post(
  '/products',
  requireAuth,
  validate(
    z.object({
      name: z.string().min(1).max(120),
      description: z.string().max(2000).optional(),
      kind: z.enum(['PHYSICAL', 'DIGITAL', 'COURSE', 'PRESET', 'AFFILIATE']),
      priceCents: z.number().int().nonnegative(),
      currency: z.string().length(3).default('USD'),
      mediaUrls: z.array(z.string().url()).default([]),
      inventory: z.number().int().nonnegative().optional(),
      affiliateUrl: z.string().url().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.findUniqueOrThrow({ where: { userId: req.user!.id } });
    const product = await prisma.product.create({
      data: { ...req.body, creatorId: creator.id, status: 'ACTIVE' },
    });
    return created(res, product, 'Product published');
  }),
);

router.post(
  '/orders',
  requireAuth,
  validate(z.object({ productId: z.string(), shippingAddress: z.record(z.unknown()).optional() })),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: req.body.productId } });
    const order = await prisma.order.create({
      data: {
        buyerId: req.user!.id,
        productId: product.id,
        amountCents: product.priceCents,
        currency: product.currency,
        shippingAddress: req.body.shippingAddress,
        status: 'PENDING',
      },
    });
    return created(res, order, 'Order created');
  }),
);

router.post(
  '/gifts',
  requireAuth,
  validate(z.object({ receiverId: z.string().optional(), creatorId: z.string().optional(), kind: z.string().min(1), amountCents: z.number().int().positive(), currency: z.string().length(3).default('USD') })),
  asyncHandler(async (req, res) => {
    const gift = await prisma.gift.create({ data: { senderId: req.user!.id, ...req.body } });
    return created(res, gift, 'Gift sent');
  }),
);

router.post(
  '/subscriptions',
  requireAuth,
  validate(z.object({ creatorId: z.string().optional(), type: z.enum(['PRO', 'CREATOR', 'VERIFICATION', 'FAN']), priceCents: z.number().int().nonnegative(), currentPeriodEnd: z.string().datetime() })),
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.create({
      data: {
        subscriberId: req.user!.id,
        creatorId: req.body.creatorId,
        type: req.body.type,
        priceCents: req.body.priceCents,
        currentPeriodEnd: new Date(req.body.currentPeriodEnd),
      },
    });
    return created(res, subscription, 'Subscription started');
  }),
);

export { router as creatorRouter };
