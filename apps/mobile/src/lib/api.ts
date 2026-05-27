import Constants from 'expo-constants';
import { io } from 'socket.io-client';
import { storage } from './storage';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
export const API_URL = extra?.apiUrl ?? 'http://localhost:4000/api/v1';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = storage.getString('accessToken');
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? 'KrazyVerse request failed');
  }
  return payload.data as T;
}

export function socket() {
  const token = storage.getString('accessToken');
  return io(API_URL.replace('/api/v1', ''), {
    auth: { token },
    transports: ['websocket'],
  });
}
