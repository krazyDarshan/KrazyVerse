import type { z } from 'zod';
import type {
  apiErrorSchema,
  apiResponseSchema,
  paginatedMetaSchema,
  publicProfileSchema,
} from './validators';

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiResponse<T> = Omit<z.infer<typeof apiResponseSchema>, 'data'> & {
  data?: T;
};
export type PaginatedMeta = z.infer<typeof paginatedMetaSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;

export type ThemeName = 'purple' | 'ocean' | 'sunset' | 'forest' | 'midnight';

export type MediaKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';

export type AuthProvider = 'EMAIL' | 'GOOGLE' | 'APPLE' | 'PHONE' | 'CLERK' | 'FIREBASE';

export type NotificationKind =
  | 'LIKE'
  | 'COMMENT'
  | 'FOLLOW'
  | 'FOLLOW_REQUEST'
  | 'MENTION'
  | 'DM'
  | 'LIVE'
  | 'SECURITY'
  | 'SYSTEM';

export type FeedMode = 'following' | 'recommended' | 'trending';

export type SocketClientEvents = {
  'message:send': {
    conversationId: string;
    content?: string;
    mediaIds?: string[];
    clientId: string;
  };
  'typing:start': { conversationId: string };
  'typing:stop': { conversationId: string };
  'presence:update': { status: 'ONLINE' | 'OFFLINE' | 'AWAY' };
  'story:view': { storyId: string };
};

export type SocketServerEvents = {
  'message:new': unknown;
  'typing:update': { conversationId: string; userId: string; isTyping: boolean };
  'presence:update': { userId: string; status: 'ONLINE' | 'OFFLINE' | 'AWAY' };
  'notification:new': unknown;
  'story:viewed': { storyId: string; viewerId: string };
};
