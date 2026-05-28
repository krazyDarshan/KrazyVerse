import { NotificationKind, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

type NotificationPayload = {
  recipientId: string;
  actorId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
};

type NotificationWithActor = Prisma.NotificationGetPayload<{
  include: { actor: { include: { profile: true } } };
}>;

let emitNotification:
  | ((recipientId: string, notification: NotificationWithActor) => void)
  | undefined;

export function setNotificationEmitter(
  emitter: (recipientId: string, notification: NotificationWithActor) => void,
) {
  emitNotification = emitter;
}

export async function createNotification(input: NotificationPayload) {
  if (input.actorId && input.actorId === input.recipientId) {
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      actorId: input.actorId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
      data: input.data as Prisma.InputJsonValue | undefined,
    },
    include: { actor: { include: { profile: true } } },
  });

  emitNotification?.(input.recipientId, notification);
  return notification;
}

export async function createMentionNotifications(input: {
  actorId: string;
  text?: string | null;
  entityType: string;
  entityId: string;
}) {
  const usernames = Array.from(
    new Set(
      (input.text?.match(/@[a-zA-Z0-9._]{3,30}/g) ?? []).map((mention) =>
        mention.slice(1).toLowerCase(),
      ),
    ),
  );

  if (!usernames.length) {
    return [];
  }

  const profiles = await prisma.profile.findMany({
    where: { username: { in: usernames } },
    select: { userId: true, username: true },
  });

  return Promise.all(
    profiles.map((profile) =>
      createNotification({
        recipientId: profile.userId,
        actorId: input.actorId,
        kind: 'MENTION',
        title: 'You were mentioned',
        body: `@${profile.username} was mentioned in KrazyVerse.`,
        entityType: input.entityType,
        entityId: input.entityId,
      }),
    ),
  );
}
