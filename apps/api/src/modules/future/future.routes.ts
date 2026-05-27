import { Router } from 'express';
import { FUTURE_FEATURES } from '@krazyverse/shared';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/async-handler';
import { ok } from '../../utils/http';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    return ok(
      res,
      FUTURE_FEATURES.map((feature) => ({ feature, status: 'scaffolded' })),
      'Future feature entry points',
    );
  }),
);

router.get('/vr-social-rooms', requireAuth, asyncHandler(async (_req, res) => ok(res, { provider: 'WebXR', entry: '/webxr/rooms', status: 'scaffolded' }, 'VR social rooms scaffold')));
router.get('/3d-avatars', requireAuth, asyncHandler(async (_req, res) => ok(res, { provider: 'Ready Player Me', status: 'scaffolded' }, '3D avatars scaffold')));
router.get('/ar-filters', requireAuth, asyncHandler(async (_req, res) => ok(res, { provider: '8th Wall or DeepAR', status: 'scaffolded' }, 'AR filters scaffold')));
router.get('/live-shopping', requireAuth, asyncHandler(async (_req, res) => ok(res, { provider: 'LiveKit product overlays', status: 'scaffolded' }, 'Live shopping scaffold')));
router.get('/nft-profile-badges', requireAuth, asyncHandler(async (_req, res) => ok(res, { provider: 'WalletConnect', status: 'scaffolded' }, 'NFT badges scaffold')));
router.get('/ai-virtual-influencers', requireAuth, asyncHandler(async (_req, res) => ok(res, { scheduler: 'BullMQ', status: 'scaffolded' }, 'AI virtual influencer scaffold')));
router.get('/virtual-concert-rooms', requireAuth, asyncHandler(async (_req, res) => ok(res, { provider: 'Agora or LiveKit', status: 'scaffolded' }, 'Virtual concert scaffold')));

export { router as futureRouter };
