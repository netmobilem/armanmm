import type { ApiErrorBody } from '@vira/shared';

export class ApiRequestError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

function csrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)vira_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (init?.json !== undefined) headers['Content-Type'] = 'application/json';
  const csrf = csrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  if (!res.ok) {
    const err = (parsed as ApiErrorBody | null)?.error;
    throw new ApiRequestError(err?.code ?? 'INTERNAL_ERROR', err?.message ?? res.statusText, res.status);
  }
  return (parsed as { data: T }).data;
}

export const get = <T>(p: string) => api<T>(p);
export const post = <T>(p: string, json?: unknown) => api<T>(p, { method: 'POST', json });
export const patch = <T>(p: string, json?: unknown) => api<T>(p, { method: 'PATCH', json });
export const del = <T>(p: string) => api<T>(p, { method: 'DELETE' });
