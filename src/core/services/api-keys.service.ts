import { getApiUrl } from 'modules/discord-auth/utils/urls.utils';

const buildEndpoint = (userId: string): string => getApiUrl(`/users/${userId}/api-key`);

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface UserApiKeyData {
  apiKey: string | null;
  createdAt?: string | null;
  lastUsedAt?: string | null;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Unexpected server error');
  }

  return payload.data;
}

export class ApiKeysService {
  static async fetch(userId: string): Promise<UserApiKeyData> {
    const response = await fetch(buildEndpoint(userId), { method: 'GET' });
    return handleResponse<UserApiKeyData>(response);
  }

  static async generate(userId: string): Promise<UserApiKeyData> {
    const response = await fetch(buildEndpoint(userId), { method: 'POST' });
    return handleResponse<UserApiKeyData>(response);
  }

  static async revoke(userId: string): Promise<void> {
    const response = await fetch(buildEndpoint(userId), { method: 'DELETE' });
    await handleResponse<{ apiKey: null }>(response);
  }
}
