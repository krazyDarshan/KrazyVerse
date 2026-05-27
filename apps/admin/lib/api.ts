export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export async function adminApi<T>(path: string): Promise<T> {
  const token = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    next: { revalidate: 10 },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message ?? 'Admin API request failed');
  }
  return payload.data as T;
}
