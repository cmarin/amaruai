import { fetchWithRetry } from './apiUtils';
import { ApiHeaders } from '@/app/utils/session/session';

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
    const response = await fetch(`/api/v1/chat_models`, {
      method: 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch chat models');
    }
    return await response.json();
  });
}
