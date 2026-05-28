import { Router } from 'express';
import { z } from 'zod';
import { CHAT_LIMITS, messageSchemas } from '@krazyverse/shared';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError, created, getPagination, ok } from '../../utils/http';
import { createNotification } from '../notifications/notification.service';

const router = Router();

router.post(
  '/conversations',
  requireAuth,
  validate(messageSchemas.createConversation),
  asyncHandler(async (req, res) => {
    const memberIds = Array.from(new Set([req.user!.id, ...req.body.memberIds]));
    const conversation = await prisma.conversation.create({
      data: {
        title: req.body.title,
        isGroup: req.body.isGroup || memberIds.length > 2,
        members: {
          create: memberIds.map((userId, index) => ({
            userId,
            role: index === 0 ? 'OWNER' : 'MEMBER',
          })),
        },
      },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });
    return created(res, conversation, 'Conversation created');
  }),
);

router.get(
  '/conversations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const conversations = await prisma.conversationMember.findMany({
      where: { userId: req.user!.id, archivedAt: null },
      orderBy: [{ pinnedAt: 'desc' }, { conversation: { lastMessageAt: 'desc' } }],
      include: {
        conversation: {
          include: {
            members: { include: { user: { include: { profile: true } } } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    const enriched = await Promise.all(
      conversations.map(async (member) => {
        const unreadAfter = member.lastReadAt ?? member.joinedAt;
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: member.conversationId,
            senderId: { not: req.user!.id },
            createdAt: { gt: unreadAfter },
            deletedForEveryoneAt: null,
          },
        });
        return { ...member, unreadCount };
      }),
    );
    return ok(res, enriched, 'Conversations loaded');
  }),
);

router.get(
  '/conversations/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.conversationMember.findFirstOrThrow({
      where: { conversationId: req.params.id, userId: req.user!.id },
    });
    const { cursor, limit } = getPagination(req.query);
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { sender: { include: { profile: true } }, reactions: true },
    });
    const nextCursor = messages.length > limit ? messages.at(-1)?.id : null;
    return ok(res, messages.slice(0, limit), 'Messages loaded', { cursor, nextCursor, limit });
  }),
);

router.post(
  '/send',
  requireAuth,
  validate(messageSchemas.send.extend({ encryptedPayload: z.record(z.unknown()).optional() })),
  asyncHandler(async (req, res) => {
    await prisma.conversationMember.findFirstOrThrow({
      where: { conversationId: req.body.conversationId, userId: req.user!.id },
    });
    const message = await prisma.message.create({
      data: {
        conversationId: req.body.conversationId,
        senderId: req.user!.id,
        content: req.body.content,
        encryptedPayload: req.body.encryptedPayload,
        media: req.body.mediaUrls ? { urls: req.body.mediaUrls } : undefined,
        replyToMessageId: req.body.replyToMessageId,
      },
      include: { sender: { include: { profile: true } } },
    });
    await prisma.conversation.update({
      where: { id: req.body.conversationId },
      data: { lastMessageAt: new Date() },
    });
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: req.body.conversationId,
          userId: req.user!.id,
        },
      },
      data: { lastReadAt: message.createdAt },
    });
    const recipients = await prisma.conversationMember.findMany({
      where: { conversationId: req.body.conversationId, userId: { not: req.user!.id } },
      select: { userId: true },
    });
    await Promise.allSettled(
      recipients.map((recipient) =>
        createNotification({
          recipientId: recipient.userId,
          actorId: req.user!.id,
          kind: 'DM',
          title: 'New message',
          body: message.content ?? 'Sent you a message.',
          entityType: 'CONVERSATION',
          entityId: req.body.conversationId,
          data: { messageId: message.id },
        }),
      ),
    );
    return created(res, message, 'Message sent');
  }),
);

router.post(
  '/conversations/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const readAt = new Date();
    const member = await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: req.params.id,
          userId: req.user!.id,
        },
      },
      data: { lastReadAt: readAt },
    });
    return ok(res, { conversationId: member.conversationId, readAt }, 'Conversation marked read');
  }),
);

router.patch(
  '/messages/:id',
  requireAuth,
  validate(z.object({ content: z.string().min(1).max(5000) })),
  asyncHandler(async (req, res) => {
    const message = await prisma.message.findFirstOrThrow({
      where: { id: req.params.id, senderId: req.user!.id },
    });
    const editDeadline = new Date(
      message.createdAt.getTime() + CHAT_LIMITS.editMinutes * 60 * 1000,
    );
    if (editDeadline < new Date()) {
      throw new ApiError(403, 'Message edit window has expired', 'EDIT_WINDOW_EXPIRED');
    }
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { content: req.body.content, editedAt: new Date() },
    });
    return ok(res, updated, 'Message edited');
  }),
);

router.delete(
  '/messages/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const message = await prisma.message.findFirstOrThrow({
      where: { id: req.params.id, senderId: req.user!.id },
    });
    const deleteDeadline = new Date(
      message.createdAt.getTime() + CHAT_LIMITS.deleteForEveryoneMinutes * 60 * 1000,
    );
    if (deleteDeadline < new Date()) {
      throw new ApiError(403, 'Delete-for-everyone window has expired', 'DELETE_WINDOW_EXPIRED');
    }
    await prisma.message.update({
      where: { id: message.id },
      data: { deletedForEveryoneAt: new Date(), content: null, media: undefined },
    });
    return ok(res, { deletedForEveryone: true }, 'Message deleted for everyone');
  }),
);

router.post(
  '/messages/:id/react',
  requireAuth,
  validate(z.object({ emoji: z.string().min(1).max(16) })),
  asyncHandler(async (req, res) => {
    const reaction = await prisma.reaction.create({
      data: { userId: req.user!.id, messageId: req.params.id, emoji: req.body.emoji },
    });
    return created(res, reaction, 'Reaction added');
  }),
);

router.post(
  '/messages/:id/forward',
  requireAuth,
  validate(
    z.object({ conversationIds: z.array(z.string()).min(1).max(CHAT_LIMITS.forwardChatLimit) }),
  ),
  asyncHandler(async (req, res) => {
    const source = await prisma.message.findUniqueOrThrow({ where: { id: req.params.id } });
    const forwarded = await prisma.$transaction(
      req.body.conversationIds.map((conversationId: string) =>
        prisma.message.create({
          data: {
            conversationId,
            senderId: req.user!.id,
            content: source.content,
            encryptedPayload: source.encryptedPayload ?? undefined,
            media: source.media ?? undefined,
            forwardedFromId: source.id,
          },
        }),
      ),
    );
    return created(res, forwarded, 'Message forwarded');
  }),
);

router.post(
  '/conversations/:id/pin',
  requireAuth,
  asyncHandler(async (req, res) => {
    const pinnedCount = await prisma.conversationMember.count({
      where: { userId: req.user!.id, pinnedAt: { not: null } },
    });
    if (pinnedCount >= CHAT_LIMITS.pinnedChats) {
      throw new ApiError(422, 'You can pin at most 3 chats', 'PIN_LIMIT');
    }
    const member = await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: req.params.id, userId: req.user!.id } },
      data: { pinnedAt: new Date() },
    });
    return ok(res, member, 'Chat pinned');
  }),
);

router.post(
  '/conversations/:id/archive',
  requireAuth,
  asyncHandler(async (req, res) => {
    const member = await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: req.params.id, userId: req.user!.id } },
      data: { archivedAt: new Date() },
    });
    return ok(res, member, 'Chat archived');
  }),
);

router.get(
  '/search',
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      return ok(res, [], 'Message search results');
    }
    const messages = await prisma.message.findMany({
      where: {
        content: { contains: q, mode: 'insensitive' },
        conversation: { members: { some: { userId: req.user!.id } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return ok(res, messages, 'Message search results');
  }),
);

router.post(
  '/calls',
  requireAuth,
  validate(
    z.object({
      conversationId: z.string(),
      type: z.enum(['voice', 'video']),
      screenShare: z.boolean().default(false),
    }),
  ),
  asyncHandler(async (req, res) => {
    await prisma.conversationMember.findFirstOrThrow({
      where: { conversationId: req.body.conversationId, userId: req.user!.id },
    });
    return created(
      res,
      {
        roomName: `kv-${req.body.conversationId}`,
        type: req.body.type,
        screenShare: req.body.screenShare,
        maxParticipants: 8,
        signaling: 'WebRTC',
      },
      'Call room prepared',
    );
  }),
);

export { router as messageRouter };
