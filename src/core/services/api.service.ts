import { getApiUrl } from 'modules/discord-auth/utils/urls.utils';
import { DiscordService } from 'modules/discord-auth/services/discord.service';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const auth = DiscordService.getInstance().getAuth();
  if (auth?.accessToken) {
    headers.set('Authorization', `${auth.tokenType || 'Bearer'} ${auth.accessToken}`);
  }

  const response = await fetch(getApiUrl(path), { ...options, headers });
  const text = await response.text();
  const payload = text ? JSON.parse(text) as ApiResponse<T> : null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error ?? (text.trim() || `Request failed with status ${response.status}`));
  }

  return payload.data;
}

export function toQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || typeof value === 'undefined' || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
