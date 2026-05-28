import { api, apiEnvelope } from './api';

export type AppNotification = {
  id: string;
  kind:
    | 'LIKE'
    | 'COMMENT'
    | 'FOLLOW'
    | 'FOLLOW_REQUEST'
    | 'MENTION'
    | 'DM'
    | 'LIVE'
    | 'SECURITY'
    | 'SYSTEM';
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  data?: unknown;
  readAt?: string | null;
  createdAt: string;
  actor?: {
    profile?: {
      username?: string;
      displayName?: string;
    } | null;
  } | null;
};

export async function listNotifications() {
  const envelope = await apiEnvelope<AppNotification[]>('/discovery/notifications');
  return {
    notifications: envelope.data ?? [],
    unreadCount: Number(envelope.meta?.unreadCount ?? 0),
  };
}

export async function markNotificationRead(id: string) {
  return api<{ count: number }>(`/discovery/notifications/${id}/read`, {
    method: 'POST',
  });
}

export async function markAllNotificationsRead() {
  return api<{ read: number }>('/discovery/notifications/read-all', {
    method: 'POST',
  });
}
