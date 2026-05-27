import { Router } from 'express';
import { z } from 'zod';
import { ai } from '../../integrations/ai';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { ok } from '../../utils/http';

const router = Router();

const promptSchema = z.object({ prompt: z.string().min(1).max(5000) });
const textSchema = z.object({ text: z.string().min(1).max(5000) });

router.post('/caption', requireAuth, validate(z.object({ imageContext: z.string().min(1).max(5000) })), asyncHandler(async (req, res) => ok(res, await ai.caption(req.body.imageContext), 'Caption generated')));
router.post('/hashtags', requireAuth, validate(z.object({ context: z.string().min(1).max(5000) })), asyncHandler(async (req, res) => ok(res, await ai.hashtags(req.body.context), 'Hashtags generated')));
router.post('/photo-enhance', requireAuth, validate(z.object({ imageUrl: z.string().url(), mode: z.enum(['auto-retouch', 'background-blur']).default('auto-retouch') })), asyncHandler(async (req, res) => ok(res, await ai.imageGeneration(`Enhance this photo in ${req.body.mode} style: ${req.body.imageUrl}`), 'Photo enhancement queued')));
router.post('/moderate', requireAuth, validate(textSchema), asyncHandler(async (req, res) => ok(res, await ai.moderation(req.body.text), 'Content moderation complete')));
router.post('/comment-filter', requireAuth, validate(textSchema), asyncHandler(async (req, res) => ok(res, await ai.commentFilter(req.body.text), 'Comment filtering complete')));
router.post('/friend-suggestions', requireAuth, validate(z.object({ graphContext: z.string().max(5000).default('') })), asyncHandler(async (req, res) => ok(res, await ai.friendSuggestions(req.body.graphContext), 'AI friend suggestions generated')));
router.post('/feed-ranking', requireAuth, validate(z.object({ feedContext: z.string().min(1).max(5000) })), asyncHandler(async (req, res) => ok(res, await ai.feedRanking(req.body.feedContext), 'Feed ranking generated')));
router.post('/video-assistant', requireAuth, validate(z.object({ videoContext: z.string().min(1).max(5000) })), asyncHandler(async (req, res) => ok(res, await ai.videoAssistant(req.body.videoContext), 'Video edit suggestions generated')));
router.post('/chat', requireAuth, validate(textSchema), asyncHandler(async (req, res) => ok(res, await ai.chat(req.body.text), '@ai replied')));
router.post('/avatar', requireAuth, validate(z.object({ selfieUrl: z.string().url(), style: z.string().max(120).default('stylized social avatar') })), asyncHandler(async (req, res) => ok(res, await ai.imageGeneration(`Create an avatar from selfie ${req.body.selfieUrl} in style ${req.body.style}`), 'Avatar generated')));
router.post('/profile-theme', requireAuth, validate(promptSchema), asyncHandler(async (req, res) => ok(res, await ai.imageGeneration(`Generate a social profile theme: ${req.body.prompt}`), 'Profile theme generated')));
router.post('/story', requireAuth, validate(promptSchema), asyncHandler(async (req, res) => ok(res, await ai.story(req.body.prompt), 'Story generated')));
router.post('/voice-clone', requireAuth, validate(z.object({ consent: z.literal(true), sampleUrl: z.string().url(), script: z.string().min(1).max(3000) })), asyncHandler(async (req, res) => ok(res, { provider: 'replicate', status: 'queued', consent: true, sampleUrl: req.body.sampleUrl, script: req.body.script }, 'Voice clone narration queued')));
router.post('/translate-chat', requireAuth, validate(z.object({ text: z.string().min(1).max(5000), language: z.string().min(2).max(80) })), asyncHandler(async (req, res) => ok(res, await ai.translate(req.body.text, req.body.language), 'Chat translated')));
router.post('/translated-subtitles', requireAuth, validate(z.object({ subtitles: z.string().min(1).max(10000), language: z.string().min(2).max(80) })), asyncHandler(async (req, res) => ok(res, await ai.translate(req.body.subtitles, req.body.language), 'Subtitles translated')));

export { router as aiRouter };
