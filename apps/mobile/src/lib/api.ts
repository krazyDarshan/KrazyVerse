import { removeSecureString, setSecureString, storage } from './storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'authUser';
const DEVICE_ID_KEY = 'deviceId';

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
  return requestEnvelope<T>(path, init, true);
}

async function requestEnvelope<T>(
  path: string,
  init: RequestInit,
  allowRefresh: boolean,
): Promise<ApiEnvelope<T>> {
  const token = storage.getString(ACCESS_TOKEN_KEY);
  const headers = buildHeaders(init, token);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (allowRefresh && response.status === 401 && shouldRefresh(path, payload)) {
    await refreshSession();
    return requestEnvelope<T>(path, init, false);
  }

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

function buildHeaders(init: RequestInit, token?: string) {
  const body = init.body;
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;
  return {
    ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init.headers,
  };
}

function shouldRefresh(path: string, payload: ApiEnvelope<unknown>) {
  if (path === '/auth/refresh' || path === '/auth/login' || path === '/auth/signup') {
    return false;
  }
  return ['UNAUTHORIZED', 'SESSION_REVOKED'].includes(payload.error?.code ?? '');
}

let refreshPromise: Promise<void> | null = null;

async function refreshSession() {
  refreshPromise ??= doRefreshSession().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefreshSession() {
  const refreshToken = storage.getString(REFRESH_TOKEN_KEY);
  const deviceId = storage.getString(DEVICE_ID_KEY);
  if (!refreshToken || !deviceId) {
    await clearLocalSession();
    throw new ApiClientError('Session expired. Please log in again.', 401, 'SESSION_EXPIRED');
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, deviceId }),
  });
  const payload = (await response.json()) as ApiEnvelope<{
    user: unknown;
    tokens: {
      accessToken: string;
      refreshToken: string;
      tokenType: 'Bearer';
    };
  }>;

  if (!response.ok || !payload.success || !payload.data) {
    await clearLocalSession();
    throw new ApiClientError('Session expired. Please log in again.', 401, 'SESSION_EXPIRED');
  }

  await Promise.all([
    setSecureString(ACCESS_TOKEN_KEY, payload.data.tokens.accessToken),
    setSecureString(REFRESH_TOKEN_KEY, payload.data.tokens.refreshToken),
    setSecureString(USER_KEY, JSON.stringify(payload.data.user)),
  ]);
}

async function clearLocalSession() {
  await Promise.all([
    removeSecureString(ACCESS_TOKEN_KEY),
    removeSecureString(REFRESH_TOKEN_KEY),
    removeSecureString(USER_KEY),
  ]);
}

export function socket() {
  const token = storage.getString(ACCESS_TOKEN_KEY);
  const { io } = require('socket.io-client') as typeof import('socket.io-client');

  return io(API_URL.replace('/api/v1', ''), {
    auth: { token },
    transports: ['websocket'],
  });
}
