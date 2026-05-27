import type { Server } from 'socket.io';
import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import { verifyAccessToken } from '../utils/tokens';

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token ?? socket.handshake.headers.authorization?.toString().replace('Bearer ', '');
      if (!token) {
        return next(new Error('Missing socket token'));
      }
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.sub, deviceId: payload.deviceId, role: payload.role };
      return next();
    } catch (error) {
      return next(error as Error);
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.user.id as string;
    socket.join(`user:${userId}`);
    io.emit('presence:update', { userId, status: 'ONLINE' });

    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    memberships.forEach((membership) => socket.join(`conversation:${membership.conversationId}`));

    socket.on('message:send', async (payload, ack) => {
      try {
        const member = await prisma.conversationMember.findFirst({
          where: { userId, conversationId: payload.conversationId },
        });
        if (!member) {
          throw new Error('Not a conversation member');
        }
        const message = await prisma.message.create({
          data: {
            conversationId: payload.conversationId,
            senderId: userId,
            content: payload.content,
            media: payload.mediaIds ? { mediaIds: payload.mediaIds } : undefined,
          },
          include: { sender: { include: { profile: true } }, reactions: true },
        });
        await prisma.conversation.update({
          where: { id: payload.conversationId },
          data: { lastMessageAt: new Date() },
        });
        io.to(`conversation:${payload.conversationId}`).emit('message:new', message);
        ack?.({ success: true, data: message });
      } catch (error) {
        logger.warn('Socket message failed', { error });
        ack?.({ success: false, error: { code: 'MESSAGE_SEND_FAILED' } });
      }
    });

    socket.on('typing:start', (payload) => {
      socket.to(`conversation:${payload.conversationId}`).emit('typing:update', {
        conversationId: payload.conversationId,
        userId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (payload) => {
      socket.to(`conversation:${payload.conversationId}`).emit('typing:update', {
        conversationId: payload.conversationId,
        userId,
        isTyping: false,
      });
    });

    socket.on('story:view', async (payload) => {
      await prisma.storyView
        .upsert({
          where: { storyId_viewerId: { storyId: payload.storyId, viewerId: userId } },
          create: { storyId: payload.storyId, viewerId: userId },
          update: {},
        })
        .catch(() => undefined);
      const story = await prisma.story.findUnique({ where: { id: payload.storyId }, select: { authorId: true } });
      if (story) {
        io.to(`user:${story.authorId}`).emit('story:viewed', { storyId: payload.storyId, viewerId: userId });
      }
    });

    socket.on('disconnect', () => {
      io.emit('presence:update', { userId, status: 'OFFLINE' });
    });
  });
}
