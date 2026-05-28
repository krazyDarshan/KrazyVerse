import { api } from './api';
import { storage } from './storage';

export type Conversation = {
  id: string;
  title?: string | null;
  isGroup: boolean;
  members?: Array<{
    userId: string;
    user?: {
      profile?: {
        username?: string;
        displayName?: string;
      } | null;
    } | null;
  }>;
  messages?: Message[];
  lastMessageAt?: string;
};

export type ConversationListItem = {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt?: string | null;
  pinnedAt?: string | null;
  archivedAt?: string | null;
  unreadCount?: number;
  conversation: Conversation;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content?: string | null;
  media?: unknown;
  createdAt: string;
  editedAt?: string | null;
  sender?: {
    profile?: {
      username?: string;
      displayName?: string;
    } | null;
  } | null;
};

export type UserSearchResult = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  profilePictureUrl?: string | null;
  verified?: boolean;
};

type SocketLike = {
  connected: boolean;
  emit(event: string, payload?: unknown, ack?: (response: unknown) => void): void;
};

const SAVED_CONVERSATION_KEY = 'savedConversationId';

export async function listConversations() {
  return api<ConversationListItem[]>('/messages/conversations');
}

export async function loadMessages(conversationId: string) {
  const messages = await api<Message[]>(
    `/messages/conversations/${conversationId}/messages?limit=30`,
  );
  return messages.reverse();
}

export async function sendMessage(input: {
  conversationId: string;
  content: string;
  mediaUrls?: string[];
}) {
  return api<Message>('/messages/send', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: input.conversationId,
      content: input.content,
      mediaUrls: input.mediaUrls,
      clientId: `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }),
  });
}

export async function markConversationRead(conversationId: string) {
  return api<{ conversationId: string; readAt: string }>(
    `/messages/conversations/${conversationId}/read`,
    {
      method: 'POST',
    },
  );
}

export function sendRealtimeMessage(
  socketClient: SocketLike | null,
  input: {
    conversationId: string;
    content: string;
    mediaUrls?: string[];
  },
) {
  return new Promise<Message>((resolve, reject) => {
    if (!socketClient?.connected) {
      reject(new Error('Realtime chat is reconnecting. Try again in a moment.'));
      return;
    }

    socketClient.emit(
      'message:send',
      {
        conversationId: input.conversationId,
        content: input.content,
        mediaUrls: input.mediaUrls,
      },
      (response) => {
        const payload = response as
          | { success: true; data: Message }
          | { success: false; error?: { code?: string } };
        if (payload?.success) {
          resolve(payload.data);
          return;
        }
        reject(new Error(payload?.error?.code ?? 'Message could not be sent.'));
      },
    );
  });
}

export async function searchUsers(query: string) {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }
  const results = await api<{ users: UserSearchResult[] }>(
    `/discovery/search?type=users&q=${encodeURIComponent(q)}`,
  );
  return results.users;
}

export async function startDirectConversation(currentUserId: string, otherUser: UserSearchResult) {
  const conversations = await listConversations();
  const existing = conversations.find(({ conversation }) => {
    if (conversation.isGroup) {
      return false;
    }
    const memberIds = conversation.members?.map((member) => member.userId) ?? [];
    return memberIds.includes(currentUserId) && memberIds.includes(otherUser.userId);
  });

  if (existing) {
    return existing.conversation;
  }

  return api<Conversation>('/messages/conversations', {
    method: 'POST',
    body: JSON.stringify({
      memberIds: [otherUser.userId],
      isGroup: false,
    }),
  });
}

export async function getOrCreateSavedConversation(currentUserId: string) {
  const cachedId = storage.getString(SAVED_CONVERSATION_KEY);
  const conversations = await listConversations();

  const cached = cachedId
    ? conversations.find((item) => item.conversationId === cachedId)?.conversation
    : undefined;
  if (cached) {
    return cached;
  }

  const existing = conversations.find(
    (item) => item.conversation.title === 'Saved Messages',
  )?.conversation;
  if (existing) {
    storage.set(SAVED_CONVERSATION_KEY, existing.id);
    return existing;
  }

  const created = await api<Conversation>('/messages/conversations', {
    method: 'POST',
    body: JSON.stringify({
      memberIds: [currentUserId],
      title: 'Saved Messages',
      isGroup: false,
    }),
  });
  storage.set(SAVED_CONVERSATION_KEY, created.id);
  return created;
}

export async function sharePostToSavedMessages(input: {
  currentUserId: string;
  postId: string;
  caption?: string | null;
}) {
  const conversation = await getOrCreateSavedConversation(input.currentUserId);
  const share = await api<{ url: string; sharedBy: string }>(`/posts/${input.postId}/share`, {
    method: 'POST',
  });
  const content = `Shared post${input.caption ? `: ${input.caption}` : ''}\n${share.url}`;
  await sendMessage({ conversationId: conversation.id, content });
  return conversation;
}
