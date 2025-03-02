import { fetchWithRetry } from './api-utils';
import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';

// Simple in-memory request tracker to prevent duplicate calls
const requestTracker: {
  [key: string]: boolean
} = {};

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
  // Create a request key
  const requestKey = 'chat_models';
  
  // Check if we're already making this exact request
  if (requestTracker[requestKey]) {
    console.log(`Duplicate request prevented: ${requestKey}`);
    // Return a promise that never resolves during the lock period
    // This will prevent the state from being updated with an empty array
    return new Promise((resolve) => {
      const checkLock = () => {
        if (!requestTracker[requestKey]) {
          // When the lock is released, try again
          fetchChatModels(headers).then(resolve);
        } else {
          // Check again after a short delay
          setTimeout(checkLock, 100);
        }
      };
      setTimeout(checkLock, 100);
    });
  }
  
  // Mark this request as in progress
  requestTracker[requestKey] = true;

  try {
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
  } finally {
    // Clear the request tracker after a delay
    setTimeout(() => {
      delete requestTracker[requestKey];
    }, 2000);
  }
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
  return fetchWithRetry(async () => {
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
}

export async function deleteChatModel(id: string, headers: ApiHeaders): Promise<void> {
  return fetchWithRetry(async () => {
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
}

export async function createChatModel(model: Partial<ChatModel>, headers: ApiHeaders): Promise<ChatModel> {
  return fetchWithRetry(async () => {
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
}

export async function favoriteChatModel(chatModelId: string, headers: ApiHeaders): Promise<void> {
  return await fetchWithRetry(async () => {
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
}

export async function unfavoriteChatModel(chatModelId: string, headers: ApiHeaders): Promise<void> {
  return await fetchWithRetry(async () => {
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
}

export async function fetchFavoriteChatModels(headers: ApiHeaders): Promise<ChatModel[]> {
  // Create a request key
  const requestKey = 'favorite_chat_models';
  
  // Check if we're already making this exact request
  if (requestTracker[requestKey]) {
    console.log(`Duplicate request prevented: ${requestKey}`);
    // Return a promise that never resolves during the lock period
    // This will prevent the state from being updated with an empty array
    return new Promise((resolve) => {
      const checkLock = () => {
        if (!requestTracker[requestKey]) {
          // When the lock is released, try again
          fetchFavoriteChatModels(headers).then(resolve);
        } else {
          // Check again after a short delay
          setTimeout(checkLock, 100);
        }
      };
      setTimeout(checkLock, 100);
    });
  }
  
  // Mark this request as in progress
  requestTracker[requestKey] = true;

  try {
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
  } finally {
    // Clear the request tracker after a delay
    setTimeout(() => {
      delete requestTracker[requestKey];
    }, 2000);
  }
}