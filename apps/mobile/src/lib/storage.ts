import * as SecureStore from 'expo-secure-store';

type StorageAdapter = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
};

const memory = new Map<string, string>();

export const storage: StorageAdapter = {
  getString: (key) => memory.get(key),
  set: (key, value) => {
    memory.set(key, value);
  },
  remove: (key) => {
    memory.delete(key);
  },
};

async function canUseSecureStore() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getSecureString(key: string) {
  const existing = storage.getString(key);
  if (existing) {
    return existing;
  }

  try {
    if (!(await canUseSecureStore())) {
      return undefined;
    }
    const value = await SecureStore.getItemAsync(key);
    if (value) {
      storage.set(key, value);
    }
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

export async function setSecureString(key: string, value: string) {
  storage.set(key, value);
  try {
    if (await canUseSecureStore()) {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    // Memory storage still keeps the app usable for the current session.
  }
}

export async function removeSecureString(key: string) {
  storage.remove(key);
  try {
    if (await canUseSecureStore()) {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // A failed secure delete should not block logout in the running app.
  }
}

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
