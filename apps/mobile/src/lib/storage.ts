import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({ id: 'krazyverse' });

export function cacheJson(key: string, value: unknown) {
  storage.set(key, JSON.stringify({ value, cachedAt: Date.now() }));
}

export function readCachedJson<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw).value as T;
  } catch {
    return null;
  }
}
