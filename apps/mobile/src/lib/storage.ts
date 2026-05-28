type StorageAdapter = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
};

const memory = new Map<string, string>();

export const storage: StorageAdapter = {
  getString: (key) => memory.get(key),
  set: (key, value) => {
    memory.set(key, value);
  },
};

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
