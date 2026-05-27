import { ApiError } from '../../utils/http';
import { detectMediaMode, normalizeHashtags } from './post.service';

describe('post module', () => {
  it('normalizes, deduplicates, and caps hashtags', () => {
    const tags = normalizeHashtags(['#ReactNative', ' reactnative ', 'Expo', '', '#AI']);
    expect(tags).toEqual(['reactnative', 'expo', 'ai']);
  });

  it('detects media modes for image, video, and carousel posts', () => {
    expect(detectMediaMode([{ type: 'IMAGE', url: 'https://cdn.test/a.jpg' }])).toBe('single-image');
    expect(detectMediaMode([{ type: 'VIDEO', url: 'https://cdn.test/a.mp4' }])).toBe('single-video');
    expect(
      detectMediaMode([
        { type: 'IMAGE', url: 'https://cdn.test/a.jpg' },
        { type: 'IMAGE', url: 'https://cdn.test/b.jpg' },
      ]),
    ).toBe('carousel');
  });

  it('rejects empty media payloads', () => {
    expect(() => detectMediaMode([])).toThrow(ApiError);
  });
});
