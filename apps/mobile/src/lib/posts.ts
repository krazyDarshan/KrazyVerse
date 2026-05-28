import { api } from './api';

export type FeedMode = 'recommended' | 'following' | 'trending';

export type FeedPost = {
  id: string;
  caption?: string | null;
  media?: Array<{
    id?: string;
    type: 'IMAGE' | 'VIDEO';
    url: string;
    thumbnailUrl?: string | null;
    altText?: string | null;
  }>;
  author?: {
    id?: string;
    profile?: {
      username?: string;
      displayName?: string;
      profilePictureUrl?: string | null;
    } | null;
  } | null;
  _count?: {
    likes?: number;
    comments?: number;
    saves?: number;
  };
};

export type PostComment = {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
  replies?: PostComment[];
  author?: {
    profile?: {
      username?: string;
      displayName?: string;
    } | null;
  } | null;
  _count?: {
    likes?: number;
  };
};

export type CreatePostMedia = {
  uri: string;
  width?: number;
  height?: number;
  mimeType?: string;
  fileName?: string;
};

export type UploadedMedia = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  duration?: number;
  resourceType: 'image' | 'video' | string;
  provider: 'cloudinary' | 'local-dev';
};

function extractHashtags(caption: string) {
  const matches = caption.match(/#[a-zA-Z0-9_]+/g) ?? [];
  return Array.from(new Set(matches.map((tag) => tag.replace('#', '').toLowerCase()))).slice(0, 30);
}

export async function createPost(input: { caption: string; media: CreatePostMedia }) {
  const caption = input.caption.trim();
  const uploaded = await uploadMedia(input.media);

  return api<FeedPost>('/posts', {
    method: 'POST',
    body: JSON.stringify({
      caption,
      hashtags: extractHashtags(caption),
      visibility: 'PUBLIC',
      media: [
        {
          type: 'IMAGE',
          url: uploaded.url,
          width: uploaded.width ?? input.media.width,
          height: uploaded.height ?? input.media.height,
          altText: caption || 'KrazyVerse post image',
          metadata: {
            source: 'mobile-upload',
            provider: uploaded.provider,
            publicId: uploaded.publicId,
          },
        },
      ],
    }),
  });
}

async function uploadMedia(media: CreatePostMedia) {
  const formData = new FormData();
  formData.append('file', {
    uri: media.uri,
    name: media.fileName ?? fileNameFromUri(media.uri),
    type: media.mimeType ?? mimeTypeFromUri(media.uri),
  } as unknown as Blob);

  return api<UploadedMedia>('/uploads/media', {
    method: 'POST',
    body: formData,
  });
}

function fileNameFromUri(uri: string) {
  const rawName = uri.split('/').pop()?.split('?')[0];
  return rawName && rawName.includes('.') ? rawName : `krazyverse-${Date.now()}.jpg`;
}

function mimeTypeFromUri(uri: string) {
  const lower = uri.toLowerCase().split('?')[0] ?? '';
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) {
    return 'image/heic';
  }
  return 'image/jpeg';
}

export async function loadFeed(mode: FeedMode = 'recommended') {
  return api<FeedPost[]>(`/feed?mode=${mode}`);
}

export async function loadRecommendedFeed() {
  return loadFeed('recommended');
}

export async function togglePostLike(postId: string) {
  return api<{ liked: boolean }>(`/posts/${postId}/like`, {
    method: 'POST',
  });
}

export async function loadPostComments(postId: string) {
  return api<PostComment[]>(`/posts/${postId}/comments?limit=20`);
}

export async function addPostComment(postId: string, content: string, parentId?: string) {
  return api<PostComment>(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      parentId,
    }),
  });
}
