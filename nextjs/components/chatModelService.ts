import { fetchWithRetry } from './apiUtils';
import { ApiHeaders } from '@/app/utils/session/session';
import { API_BASE_URL } from './apiConfig';

export type ChatModel = {
  id: number;
  name: string;
  model: string;
  provider: string;
  api_type: string;
  max_tokens: number;
  temperature: number;
};

export async function fetchChatModels(headers: ApiHeaders): Promise<ChatModel[]> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat_models`, {
      method: 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch chat models');
    }
    return await response.json();
  });
}
