import { storage } from './storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code?: string;
    details?: unknown;
  };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const envelope = await apiEnvelope<T>(path, init);
  return envelope.data as T;
}

export async function apiEnvelope<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  const token = storage.getString('accessToken');
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    throw new ApiClientError(
      payload.message ?? 'KrazyVerse request failed',
      response.status,
      payload.error?.code,
      payload.error?.details,
    );
  }
  return payload;
}

export function socket() {
  const token = storage.getString('accessToken');
  const { io } = require('socket.io-client') as typeof import('socket.io-client');

  return io(API_URL.replace('/api/v1', ''), {
    auth: { token },
    transports: ['websocket'],
  });
}
