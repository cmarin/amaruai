import { fetchWithRetry } from './api-utils';
import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';

export interface ChatModel {
  id: string;
  name: string;
  model: string;
  provider: string;
  api_key: string;
  max_tokens: number;
  temperature: number;
  created_at?: string;
  updated_at?: string;
}

export async function fetchChatModels(headers: ApiHeaders): Promise<ChatModel[]> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/chat_models`, {
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
      id: model.id.toString()
    }));
  });
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
      id: model.id.toString()
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
