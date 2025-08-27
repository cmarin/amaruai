import { fetchWithRetry } from './api-utils';
import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';
import { cachedRequest, invalidateCache } from './api-request-manager';

export interface ChatModel {
  id: string;
  name: string;
  model: string;
  provider: string;
  api_key: string;
  max_tokens: number;
  temperature: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
  is_favorite?: boolean;
  default?: boolean;
  position?: number | null;
}

export async function fetchChatModels(headers: ApiHeaders): Promise<ChatModel[]> {
  return cachedRequest(
    'chat_models',
    async () => {
      return await fetchWithRetry(async () => {
        const response = await fetch(`${getApiUrl()}/chat_models?limit=30`, {
          method: 'GET',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch chat models');
        }
        const data = await response.json();
        return data.map((model: any) => ({
          ...model,
          id: model.id.toString(),
          is_favorite: model.is_favorite || model.is_favorited || false,
          position: model.position !== undefined ? model.position : null
        }));
      });
    },
    {
      ttl: 30, // Cache for 30 minutes
      debug: process.env.NODE_ENV === 'development'
    }
  );
}

export async function fetchChatModel(id: string, headers: ApiHeaders): Promise<ChatModel> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/chat_models/${id}`, {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch chat model');
    }
    const model = await response.json();
    return {
      ...model,
      id: model.id.toString(),
      is_favorite: model.is_favorite || false
    };
  });
}

export async function updateChatModel(id: string, model: Partial<ChatModel>, headers: ApiHeaders): Promise<ChatModel> {
  const result = await fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/chat_models/${id}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(model),
    });

    if (!response.ok) {
      throw new Error('Failed to update chat model');
    }

    const data = await response.json();
    return {
      ...data,
      id: data.id.toString()
    };
  });

  // Invalidate related caches after successful update
  invalidateCache(/^chat_models/);
  
  return result;
}

export async function deleteChatModel(id: string, headers: ApiHeaders): Promise<void> {
  await fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/chat_models/${id}`, {
      method: 'DELETE',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete chat model');
    }
  });

  // Invalidate related caches after successful deletion
  invalidateCache(/^chat_models/);
}

export async function createChatModel(model: Partial<ChatModel>, headers: ApiHeaders): Promise<ChatModel> {
  const result = await fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/chat_models`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(model),
    });

    if (!response.ok) {
      throw new Error('Failed to create chat model');
    }

    const data = await response.json();
    return {
      ...data,
      id: data.id.toString()
    };
  });

  // Invalidate related caches after successful creation
  invalidateCache(/^chat_models/);
  
  return result;
}

export async function favoriteChatModel(chatModelId: string, headers: ApiHeaders): Promise<void> {
  await fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/chat_models/${chatModelId}/favorite`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error favoriting chat model:', response.status, errorText);
      throw new Error('Failed to favorite chat model');
    }
  });

  // Invalidate related caches after successful favorite
  invalidateCache(/^chat_models/);
}

export async function unfavoriteChatModel(chatModelId: string, headers: ApiHeaders): Promise<void> {
  await fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/chat_models/${chatModelId}/unfavorite`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error unfavoriting chat model:', response.status, errorText);
      throw new Error('Failed to unfavorite chat model');
    }
  });

  // Invalidate related caches after successful unfavorite
  invalidateCache(/^chat_models/);
}

export async function fetchFavoriteChatModels(headers: ApiHeaders): Promise<ChatModel[]> {
  return cachedRequest(
    'chat_models/favorites',
    async () => {
      return await fetchWithRetry(async () => {
        const response = await fetch(`${getApiUrl()}/chat_models/favorites?limit=30`, {
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error fetching favorite chat models:', response.status, errorText);
          throw new Error('Failed to fetch favorite chat models');
        }

        const data = await response.json();
        return data.map((model: any) => ({
          ...model,
          id: model.id.toString(),
          is_favorite: true // These are from favorites endpoint, so they are all favorites
        }));
      });
    },
    {
      ttl: 30, // Cache for 30 minutes
      debug: process.env.NODE_ENV === 'development'
    }
  );
}