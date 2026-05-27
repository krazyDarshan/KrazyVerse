import { ContentStatus, CopyrightStatus, ModerationStatus, PostVisibility, Prisma } from '@prisma/client';
import { POST_LIMITS } from '@krazyverse/shared';
import { prisma } from '../../db/prisma';
import { enqueue } from '../../jobs/queues';
import { ApiError } from '../../utils/http';
import { addDays } from '../../utils/security';
import { indexSearchDocument } from '../../integrations/search';

type MediaInput = {
  type: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  altText?: string;
  order?: number;
  metadata?: Record<string, unknown>;
};

export function normalizeHashtags(tags: string[] = []) {
  const normalized = tags
    .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean)
    .slice(0, POST_LIMITS.hashtags);
  return Array.from(new Set(normalized));
}

export function detectMediaMode(media: MediaInput[]) {
  if (media.length === 0) {
    throw new ApiError(422, 'At least one media item is required', 'MEDIA_REQUIRED');
  }
  if (media.length > POST_LIMITS.carouselMedia) {
    throw new ApiError(422, 'Carousel posts can include at most 10 items', 'MEDIA_LIMIT_EXCEEDED');
  }
  if (media.length === 1) {
    return media[0]!.type === 'VIDEO' ? 'single-video' : 'single-image';
  }
  return 'carousel';
}

async function syncHashtags(postId: string, tags: string[]) {
  await prisma.postHashtag.deleteMany({ where: { postId } });
  await Promise.all(
    normalizeHashtags(tags).map(async (tag) => {
      const hashtag = await prisma.hashtag.upsert({
        where: { tag },
        create: { tag, useCount: 1 },
        update: { useCount: { increment: 1 } },
      });
      await prisma.postHashtag.create({
        data: { postId, hashtagId: hashtag.id },
      });
    }),
  );
}

async function syncTaggedUsers(postId: string, taggedUserIds: string[] = []) {
  await prisma.postTag.deleteMany({ where: { postId } });
  if (taggedUserIds.length > POST_LIMITS.taggedPeople) {
    throw new ApiError(422, 'You can tag at most 20 users', 'TAG_LIMIT_EXCEEDED');
  }
  if (taggedUserIds.length === 0) {
    return;
  }
  await prisma.postTag.createMany({
    data: Array.from(new Set(taggedUserIds)).map((taggedUserId) => ({ postId, taggedUserId })),
    skipDuplicates: true,
  });
}

export const postService = {
  async createPost(
    authorId: string,
    input: {
      caption?: string;
      media: MediaInput[];
      hashtags?: string[];
      locationId?: string;
      taggedUserIds?: string[];
      visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
      scheduledAt?: string;
      isPollEnabled?: boolean;
      pollOptions?: string[];
    },
  ) {
    detectMediaMode(input.media);
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
    const isScheduled = Boolean(scheduledAt && scheduledAt > new Date());

    const post = await prisma.post.create({
      data: {
        authorId,
        caption: input.caption,
        locationId: input.locationId,
        visibility: input.visibility as PostVisibility,
        scheduledAt,
        publishedAt: isScheduled ? undefined : new Date(),
        status: isScheduled ? ContentStatus.SCHEDULED : ContentStatus.PUBLISHED,
        aiModerationStatus: ModerationStatus.PENDING,
        copyrightStatus: CopyrightStatus.PENDING,
        pollOptions: input.isPollEnabled ? input.pollOptions ?? [] : undefined,
        media: {
          create: input.media.map((media, order) => ({
            type: media.type,
            url: media.url,
            thumbnailUrl: media.thumbnailUrl,
            width: media.width,
            height: media.height,
            durationMs: media.durationMs,
            altText: media.altText,
            metadata: media.metadata as Prisma.InputJsonValue | undefined,
            order: media.order ?? order,
          })),
        },
      },
      include: { media: true, author: { include: { profile: true } } },
    });

    await syncHashtags(post.id, input.hashtags ?? []);
    await syncTaggedUsers(post.id, input.taggedUserIds);

    await Promise.allSettled([
      enqueue('moderation', 'moderate-text', { type: 'post', postId: post.id, caption: post.caption }),
      enqueue('media', 'copyright-scan', { postId: post.id, media: input.media }),
      indexSearchDocument('posts', {
        id: post.id,
        caption: post.caption,
        authorId,
        username: undefined,
        createdAt: post.createdAt.toISOString(),
      }),
    ]);

    return prisma.post.findUniqueOrThrow({
      where: { id: post.id },
      include: {
        media: { orderBy: { order: 'asc' } },
        hashtags: { include: { hashtag: true } },
        taggedUsers: true,
        author: { include: { profile: true } },
      },
    });
  },

  async getPost(postId: string, viewerId?: string) {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: { not: ContentStatus.DELETED },
      },
      include: {
        media: { orderBy: { order: 'asc' } },
        hashtags: { include: { hashtag: true } },
        taggedUsers: { include: { taggedUser: { include: { profile: true } } } },
        author: { include: { profile: true } },
        _count: { select: { likes: true, comments: true, saves: true } },
      },
    });

    if (!post) {
      throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
    }

    if (post.status === ContentStatus.ARCHIVED && post.authorId !== viewerId) {
      throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
    }

    return post;
  },

  async updatePost(
    authorId: string,
    postId: string,
    input: { caption?: string; hashtags?: string[]; taggedUserIds?: string[]; locationId?: string | null },
  ) {
    const post = await prisma.post.findFirst({ where: { id: postId, authorId } });
    if (!post) {
      throw new ApiError(404, 'Post not found or not editable', 'POST_NOT_FOUND');
    }
    if (post.status === ContentStatus.DELETED) {
      throw new ApiError(409, 'Deleted posts must be restored before editing', 'POST_DELETED');
    }

    await prisma.post.update({
      where: { id: postId },
      data: {
        caption: input.caption,
        locationId: input.locationId,
      },
    });

    if (input.hashtags) {
      await syncHashtags(postId, input.hashtags);
    }
    if (input.taggedUserIds) {
      await syncTaggedUsers(postId, input.taggedUserIds);
    }

    return this.getPost(postId, authorId);
  },

  async archivePost(authorId: string, postId: string) {
    await prisma.post.updateMany({
      where: { id: postId, authorId, status: { not: ContentStatus.DELETED } },
      data: { status: ContentStatus.ARCHIVED, archivedAt: new Date() },
    });
    return this.getPost(postId, authorId);
  },

  async softDeletePost(authorId: string, postId: string) {
    const result = await prisma.post.updateMany({
      where: { id: postId, authorId, status: { not: ContentStatus.DELETED } },
      data: {
        status: ContentStatus.DELETED,
        deletedAt: new Date(),
        recoveryUntil: addDays(new Date(), POST_LIMITS.softDeleteRecoveryDays),
      },
    });
    if (result.count === 0) {
      throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
    }
    return { deleted: true, recoveryDays: POST_LIMITS.softDeleteRecoveryDays };
  },

  async restorePost(authorId: string, postId: string) {
    const post = await prisma.post.findFirst({ where: { id: postId, authorId } });
    if (!post || post.status !== ContentStatus.DELETED) {
      throw new ApiError(404, 'Recoverable post not found', 'POST_NOT_FOUND');
    }
    if (post.recoveryUntil && post.recoveryUntil < new Date()) {
      throw new ApiError(410, 'Post recovery window has expired', 'RECOVERY_EXPIRED');
    }
    return prisma.post.update({
      where: { id: postId },
      data: { status: ContentStatus.PUBLISHED, deletedAt: null, recoveryUntil: null },
    });
  },

  async saveDraft(authorId: string, input: { id?: string; payload: Record<string, unknown> }) {
    if (input.id) {
      return prisma.postDraft.update({
        where: { id: input.id },
        data: { payload: input.payload as Prisma.InputJsonValue },
      });
    }
    return prisma.postDraft.create({ data: { authorId, payload: input.payload as Prisma.InputJsonValue } });
  },

  async listDrafts(authorId: string) {
    return prisma.postDraft.findMany({ where: { authorId }, orderBy: { updatedAt: 'desc' } });
  },

  async toggleLike(userId: string, postId: string) {
    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      return { liked: false };
    }
    await prisma.like.create({ data: { userId, postId } });
    return { liked: true };
  },

  async listLikers(postId: string) {
    return prisma.like.findMany({
      where: { postId },
      orderBy: { createdAt: 'desc' },
      include: { user: { include: { profile: true } } },
      take: 100,
    });
  },

  async toggleSave(userId: string, postId: string, collectionName = 'All') {
    const existing = await prisma.save.findUnique({
      where: { userId_postId_collectionName: { userId, postId, collectionName } },
    });
    if (existing) {
      await prisma.save.delete({ where: { id: existing.id } });
      return { saved: false };
    }
    await prisma.save.create({ data: { userId, postId, collectionName } });
    return { saved: true };
  },

  async addComment(userId: string, input: { postId: string; content: string; parentId?: string }) {
    let depth = 0;
    if (input.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: input.parentId } });
      if (!parent || parent.postId !== input.postId) {
        throw new ApiError(404, 'Parent comment not found', 'COMMENT_NOT_FOUND');
      }
      if (parent.depth >= 1) {
        throw new ApiError(422, 'Comment threads are limited to two levels', 'COMMENT_DEPTH_LIMIT');
      }
      depth = parent.depth + 1;
    }

    const comment = await prisma.comment.create({
      data: {
        authorId: userId,
        postId: input.postId,
        content: input.content,
        parentId: input.parentId,
        depth,
      },
      include: { author: { include: { profile: true } } },
    });

    await enqueue('moderation', 'moderate-text', {
      type: 'comment',
      commentId: comment.id,
      content: comment.content,
    }).catch(() => undefined);

    return comment;
  },

  async listComments(postId: string, cursor?: string, limit = 20) {
    return prisma.comment.findMany({
      where: { postId, parentId: null, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: { include: { profile: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { author: { include: { profile: true } } },
        },
        _count: { select: { likes: true } },
      },
    });
  },

  async sharePost(userId: string, postId: string) {
    await this.getPost(postId, userId);
    return {
      url: `${process.env.APP_URL ?? 'http://localhost:3000'}/post/${postId}`,
      sharedBy: userId,
    };
  },
};
