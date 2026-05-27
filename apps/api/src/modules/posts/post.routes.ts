import { Router } from 'express';
import { z } from 'zod';
import { commentSchemas, postSchemas } from '@krazyverse/shared';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { created, getPagination, ok } from '../../utils/http';
import { postService } from './post.service';

const router = Router();

router.post(
  '/',
  requireAuth,
  validate(postSchemas.create),
  asyncHandler(async (req, res) => {
    const post = await postService.createPost(req.user!.id, req.body);
    return created(res, post, 'Post created');
  }),
);

router.get(
  '/drafts',
  requireAuth,
  asyncHandler(async (req, res) => {
    const drafts = await postService.listDrafts(req.user!.id);
    return ok(res, drafts, 'Drafts loaded');
  }),
);

router.post(
  '/drafts',
  requireAuth,
  validate(postSchemas.draft),
  asyncHandler(async (req, res) => {
    const draft = await postService.saveDraft(req.user!.id, req.body);
    return ok(res, draft, 'Draft auto-saved');
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const post = await postService.getPost(req.params.id, req.user?.id);
    return ok(res, post, 'Post loaded');
  }),
);

router.patch(
  '/:id',
  requireAuth,
  validate(postSchemas.update),
  asyncHandler(async (req, res) => {
    const post = await postService.updatePost(req.user!.id, req.params.id, req.body);
    return ok(res, post, 'Post updated');
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await postService.softDeletePost(req.user!.id, req.params.id);
    return ok(res, result, 'Post moved to 30-day recovery');
  }),
);

router.post(
  '/:id/archive',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await postService.archivePost(req.user!.id, req.params.id);
    return ok(res, result, 'Post archived');
  }),
);

router.post(
  '/:id/restore',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await postService.restorePost(req.user!.id, req.params.id);
    return ok(res, result, 'Post restored');
  }),
);

router.post(
  '/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await postService.toggleLike(req.user!.id, req.params.id);
    return ok(res, result, result.liked ? 'Post liked' : 'Post unliked');
  }),
);

router.get(
  '/:id/likers',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await postService.listLikers(req.params.id);
    return ok(res, result, 'Post likers');
  }),
);

router.post(
  '/:id/save',
  requireAuth,
  validate(z.object({ collectionName: z.string().min(1).max(80).default('All') })),
  asyncHandler(async (req, res) => {
    const result = await postService.toggleSave(req.user!.id, req.params.id, req.body.collectionName);
    return ok(res, result, result.saved ? 'Post saved' : 'Post removed from saves');
  }),
);

router.post(
  '/:id/comments',
  requireAuth,
  validate(commentSchemas.create.omit({ postId: true })),
  asyncHandler(async (req, res) => {
    const comment = await postService.addComment(req.user!.id, {
      ...req.body,
      postId: req.params.id,
    });
    return created(res, comment, 'Comment added');
  }),
);

router.get(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const { cursor, limit } = getPagination(req.query);
    const comments = await postService.listComments(req.params.id, cursor, limit);
    const nextCursor = comments.length > limit ? comments.at(-1)?.id : null;
    return ok(res, comments.slice(0, limit), 'Comments loaded', { cursor, nextCursor, limit });
  }),
);

router.post(
  '/:id/share',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await postService.sharePost(req.user!.id, req.params.id);
    return ok(res, result, 'Share link created');
  }),
);

router.post(
  '/:id/not-interested',
  requireAuth,
  asyncHandler(async (req, res) => {
    return ok(res, { hidden: true, postId: req.params.id }, 'We will tune your recommendations');
  }),
);

export { router as postRouter };
