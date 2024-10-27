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

export async function fetchChatModels(headers: ApiHeaders | null): Promise<ChatModel[]> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }

    if (!headers) {
      throw new Error('No valid headers available - session might not be initialized');
    }

    // Log the request details
    console.log('=== Fetching Chat Models ===');
    console.log('Request URL:', `${API_BASE_URL}/chat_models`);
    console.log('Request Headers:', headers);
    console.log('Authorization Header:', headers?.Authorization || 'No authorization header');
    console.log('========================');

    const response = await fetch(`${API_BASE_URL}/chat_models`, {
      headers: headers as HeadersInit
    });

    // Log the response status
    console.log('Response Status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error Response:', errorText);
      throw new Error('Failed to fetch chat models');
    }

    const data = await response.json();
    console.log('Received Chat Models:', data);
    return data;
  });
}
