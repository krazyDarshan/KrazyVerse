export const APP_NAME = 'KrazyVerse';

export const API_VERSION = 'v1';

export const POST_LIMITS = {
  caption: 2200,
  hashtags: 30,
  taggedPeople: 20,
  carouselMedia: 10,
  softDeleteRecoveryDays: 30,
};

export const PROFILE_LIMITS = {
  bio: 150,
  websiteLinks: 3,
};

export const OTP_POLICY = {
  digits: 6,
  expiryMinutes: 5,
  resendSeconds: 60,
};

export const CHAT_LIMITS = {
  groupMembers: 250,
  fileBytes: 100 * 1024 * 1024,
  deleteForEveryoneMinutes: 10,
  editMinutes: 15,
  pinnedChats: 3,
  forwardChatLimit: 5,
};

export const STORY_POLICY = {
  expiresHours: 24,
  maxVideoSeconds: 60,
};

export const REEL_POLICY = {
  minSpeed: 0.3,
  maxSpeed: 3,
};

export const THEMES = ['purple', 'ocean', 'sunset', 'forest', 'midnight'] as const;
export const FONT_CHOICES = ['inter', 'nunito', 'space-grotesk'] as const;
export const STORY_REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'] as const;

export const FUTURE_FEATURES = [
  'vr-social-rooms',
  '3d-avatars',
  'ar-filters',
  'live-shopping',
  'nft-profile-badges',
  'ai-virtual-influencers',
  'virtual-concert-rooms',
] as const;
