import { fetchWithRetry } from './apiUtils';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type ChatModel = {
  id: number;
  name: string;
  model: string;
  provider: string;
  description: string | null;
  api_key: string | null;
  default: boolean;
};

export async function fetchChatModels(): Promise<ChatModel[]> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/chat_models`);
    if (!response.ok) {
      throw new Error('Failed to fetch chat models');
    }
    return await response.json();
  });
}