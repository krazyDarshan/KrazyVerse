import { api, apiEnvelope } from './api';
import { getSecureString, removeSecureString, setSecureString, storage } from './storage';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
};

export type AuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  twoFactorEnabled: boolean;
  profile?: {
    username: string;
    displayName: string;
  } | null;
};

export type AuthSession = {
  user: AuthUser;
  tokens: AuthTokens;
};

type AuthResponse = AuthSession & {
  devOtp?: string;
};

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'authUser';
const DEVICE_ID_KEY = 'deviceId';

function newDeviceId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `kv-${Date.now().toString(36)}-${random}`;
}

async function getDeviceId() {
  const existing = storage.getString(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const persisted = await getSecureString(DEVICE_ID_KEY);
  if (persisted) {
    return persisted;
  }

  const deviceId = newDeviceId();
  await setSecureString(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export function getStoredSession(): AuthSession | null {
  const accessToken = storage.getString(ACCESS_TOKEN_KEY);
  const refreshToken = storage.getString(REFRESH_TOKEN_KEY);
  const rawUser = storage.getString(USER_KEY);
  if (!accessToken || !refreshToken || !rawUser) {
    return null;
  }

  try {
    return {
      tokens: { accessToken, refreshToken, tokenType: 'Bearer' },
      user: JSON.parse(rawUser) as AuthUser,
    };
  } catch {
    void clearSession();
    return null;
  }
}

export async function loadStoredSession(): Promise<AuthSession | null> {
  const [accessToken, refreshToken, rawUser] = await Promise.all([
    getSecureString(ACCESS_TOKEN_KEY),
    getSecureString(REFRESH_TOKEN_KEY),
    getSecureString(USER_KEY),
  ]);

  if (!accessToken || !refreshToken || !rawUser) {
    return null;
  }

  try {
    return {
      tokens: { accessToken, refreshToken, tokenType: 'Bearer' },
      user: JSON.parse(rawUser) as AuthUser,
    };
  } catch {
    await clearSession();
    return null;
  }
}

export async function persistSession(session: AuthSession) {
  await Promise.all([
    setSecureString(ACCESS_TOKEN_KEY, session.tokens.accessToken),
    setSecureString(REFRESH_TOKEN_KEY, session.tokens.refreshToken),
    setSecureString(USER_KEY, JSON.stringify(session.user)),
  ]);
}

export async function clearSession() {
  await Promise.all([
    removeSecureString(ACCESS_TOKEN_KEY),
    removeSecureString(REFRESH_TOKEN_KEY),
    removeSecureString(USER_KEY),
  ]);
}

export async function signup(input: {
  email: string;
  password: string;
  username: string;
  displayName: string;
}) {
  const payload = await api<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ ...input, deviceId: await getDeviceId() }),
  });
  await persistSession(payload);
  return payload;
}

export async function login(input: { email: string; password: string; totpCode?: string }) {
  const payload = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ ...input, deviceId: await getDeviceId() }),
  });
  await persistSession(payload);
  return payload;
}

export async function verifyEmailOtp(email: string, otp: string) {
  return api<{ verified: boolean }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp, purpose: 'EMAIL_VERIFY' }),
  });
}

export async function resendEmailOtp(email: string) {
  return apiEnvelope<{ sent: boolean; devOtp?: string }>('/auth/resend-email-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function logout() {
  try {
    await api<{ revoked: boolean }>('/auth/logout', { method: 'POST' });
  } finally {
    await clearSession();
  }
}
