/**
 * authApi.ts
 *
 * JWT token management and user identity utilities.
 * All other API modules import authHeader() from here.
 */

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3001';

const TOKEN_KEY     = 'pdfchat-auth-token';
const TOKEN_EXP_KEY = 'pdfchat-auth-token-exp';
/** Refresh the token 5 minutes before it expires. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

let tokenRefreshPromise: Promise<string> | null = null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns (or generates) a persistent anonymous user ID stored in localStorage.
 * Always a UUID v4 — any legacy non-UUID value is replaced transparently.
 */
export const getUserId = (): string => {
  const stored = localStorage.getItem('pdfchat-user-id');
  if (stored && UUID_RE.test(stored)) return stored;

  // Generate a fresh UUID (replace missing or legacy non-UUID IDs).
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
  localStorage.setItem('pdfchat-user-id', id);
  return id;
};

const refreshAuthToken = async (userId: string): Promise<string> => {
  const res = await fetch(`${API_BASE_URL}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((msg.error as string) || 'Failed to obtain auth token');
  }
  const data = (await res.json()) as { token: string; expires_at: string };
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(TOKEN_EXP_KEY, data.expires_at);
  return data.token;
};

/**
 * Returns a valid auth token for the current user, refreshing it when it is
 * about to expire. Concurrent callers share a single in-flight refresh promise.
 */
export const getAuthToken = async (): Promise<string> => {
  const userId = getUserId();
  const stored = localStorage.getItem(TOKEN_KEY);
  const expStr = localStorage.getItem(TOKEN_EXP_KEY);

  if (stored && expStr) {
    const expiresAt = new Date(expStr).getTime();
    if (expiresAt - Date.now() > REFRESH_BUFFER_MS) return stored;
  }

  if (!tokenRefreshPromise) {
    tokenRefreshPromise = refreshAuthToken(userId).finally(() => {
      tokenRefreshPromise = null;
    });
  }
  return tokenRefreshPromise;
};

/** Returns the Authorization Bearer header value, or empty string on failure. */
export const authHeader = async (): Promise<string> => {
  try {
    const token = await getAuthToken();
    return `Bearer ${token}`;
  } catch {
    return '';
  }
};
