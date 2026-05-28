import { api } from './api';
import type { FeedPost } from './posts';

export type SocialProfile = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  bio?: string | null;
  profilePictureUrl?: string | null;
  verified?: boolean;
  followersCount?: number;
  followingCount?: number;
  accountType?: 'PUBLIC' | 'PRIVATE';
};

export type AppThemeName = 'purple' | 'ocean' | 'sunset' | 'forest' | 'midnight';

export type ProfileDetail = SocialProfile & {
  coverPhotoUrl?: string | null;
  websiteLinks?: string[];
  profileViews?: number;
  reach?: number;
  xp?: number;
  level?: number;
  customTheme?: { name?: AppThemeName } | Record<string, unknown> | null;
  user?: {
    id: string;
    createdAt?: string;
    posts?: FeedPost[];
  };
};

export type FollowState = 'idle' | 'following' | 'requested';

type SearchResponse = {
  users: SocialProfile[];
};

type FollowingRow = {
  followingId: string;
  following?: {
    profile?: SocialProfile | null;
  } | null;
};

export async function searchPeople(query: string) {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }
  const result = await api<SearchResponse>(
    `/discovery/search?type=users&q=${encodeURIComponent(q)}`,
  );
  return result.users;
}

export async function getProfileByUsername(username: string) {
  return api<ProfileDetail>(`/profiles/${encodeURIComponent(username.toLowerCase())}`);
}

export async function listFollowingUserIds(userId: string) {
  const following = await api<FollowingRow[]>(`/profiles/${userId}/following`);
  return new Set(following.map((row) => row.followingId));
}

export async function followUser(userId: string) {
  const result = await api<{ following: boolean; requested: boolean }>(
    `/profiles/${userId}/follow`,
    {
      method: 'POST',
    },
  );
  return result.requested ? 'requested' : result.following ? 'following' : 'idle';
}

export async function unfollowUser(userId: string) {
  await api<{ following: false; requested: false }>(`/profiles/${userId}/follow`, {
    method: 'DELETE',
  });
  return 'idle' as const;
}

export async function updateProfileSettings(input: {
  accountType?: 'PUBLIC' | 'PRIVATE';
  customTheme?: { name: AppThemeName } | null;
}) {
  return api<ProfileDetail>('/profiles/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
