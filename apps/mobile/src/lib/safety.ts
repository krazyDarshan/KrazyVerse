import { api } from './api';

export type ReportTargetType = 'USER' | 'POST' | 'COMMENT' | 'STORY' | 'REEL' | 'MESSAGE';
export type MuteScope = 'POSTS' | 'STORIES' | 'MESSAGES' | 'ALL';

export async function reportTarget(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description?: string;
}) {
  return api<{ id: string }>('/security/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function blockUser(userId: string) {
  return api<{ id: string }>(`/discovery/blocks/${userId}`, {
    method: 'POST',
  });
}

export async function unblockUser(userId: string) {
  return api<{ blocked: false; removed: boolean }>(`/discovery/blocks/${userId}`, {
    method: 'DELETE',
  });
}

export async function muteUser(userId: string, scope: MuteScope = 'ALL') {
  return api<{ id: string }>(`/discovery/mutes/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ scope }),
  });
}

export async function unmuteUser(userId: string, scope: MuteScope = 'ALL') {
  return api<{ muted: false; removed: boolean }>(`/discovery/mutes/${userId}`, {
    method: 'DELETE',
    body: JSON.stringify({ scope }),
  });
}
