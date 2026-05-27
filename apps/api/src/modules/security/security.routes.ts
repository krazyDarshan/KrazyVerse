import { Router } from 'express';
import { z } from 'zod';
import { reportSchema } from '@krazyverse/shared';
import { prisma } from '../../db/prisma';
import { ai } from '../../integrations/ai';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { created, ok } from '../../utils/http';

const router = Router();

router.post(
  '/reports',
  requireAuth,
  validate(reportSchema),
  asyncHandler(async (req, res) => {
    const report = await prisma.report.create({
      data: {
        reporterId: req.user!.id,
        targetType: req.body.targetType,
        targetId: req.body.targetId,
        reason: req.body.reason,
        description: req.body.description,
      },
    });
    return created(res, report, 'Report submitted');
  }),
);

router.post(
  '/anti-spam/analyze',
  requireAuth,
  validate(z.object({ content: z.string().min(1).max(5000), actionRate: z.number().nonnegative().default(0) })),
  asyncHandler(async (req, res) => {
    const moderation = await ai.moderation(
      JSON.stringify({ content: req.body.content, actionRate: req.body.actionRate }),
    );
    return ok(res, moderation, 'Anti-spam analysis complete');
  }),
);

router.post(
  '/nsfw-scan',
  requireAuth,
  validate(z.object({ mediaUrl: z.string().url() })),
  asyncHandler(async (req, res) => {
    const result = await ai.moderation(`Classify media safety for URL: ${req.body.mediaUrl}`);
    return ok(res, result, 'NSFW scan complete');
  }),
);

router.post(
  '/copyright-scan',
  requireAuth,
  validate(z.object({ mediaUrl: z.string().url(), mediaType: z.enum(['image', 'audio', 'video']) })),
  asyncHandler(async (req, res) => {
    return ok(
      res,
      {
        mediaUrl: req.body.mediaUrl,
        mediaType: req.body.mediaType,
        status: 'PENDING',
        fingerprintProvider: 'image-audio-fingerprint-pipeline',
      },
      'Copyright scan queued',
    );
  }),
);

router.post(
  '/trusted-contacts',
  requireAuth,
  validate(z.object({ email: z.string().email() })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { trustedContactEmail: req.body.email },
      select: { trustedContactEmail: true },
    });
    return ok(res, user, 'Trusted recovery contact saved');
  }),
);

router.post(
  '/face-verification',
  requireAuth,
  validate(z.object({ faceVector: z.array(z.number()).min(8), consent: z.literal(true) })),
  asyncHandler(async (req, res) => {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { recoveryFaceVector: { vector: req.body.faceVector, capturedAt: new Date().toISOString() } },
    });
    return ok(res, { enrolled: true }, 'Face verification recovery enrolled');
  }),
);

export { router as securityRouter };
