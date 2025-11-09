export type ProviderKey = 'openai' | 'anthropic';

export interface ProviderSettingsResponse {
  apiKey: { set: boolean; masked?: string; source: 'user' | 'env' | 'none' };
  model: { value?: string; source: 'user' | 'env' | 'none' };
}

export interface UserSettingsResponse {
  providers: Record<ProviderKey, ProviderSettingsResponse>;
  limits: { rpm?: number | null };
  updatedAt: number | null;
}

export type ProviderUpdatePayload = Partial<Record<ProviderKey, { apiKey?: string; model?: string }>>;

export interface UpdateUserSettingsPayload {
  providers?: ProviderUpdatePayload;
  limits?: { rpm?: number };
}

export async function fetchUserSettings(): Promise<UserSettingsResponse> {
  const res = await fetch('/api/user/settings', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch settings');
  const data = await res.json();
  return data.settings as UserSettingsResponse;
}

export async function updateUserSettings(payload: UpdateUserSettingsPayload): Promise<void> {
  const res = await fetch('/api/user/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update settings');
}


