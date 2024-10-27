import { ApiHeaders } from '@/app/utils/session/session';
import { API_BASE_URL } from './apiConfig';

export type Category = {
  id: number;
  name: string;
};

export async function fetchCategories(headers: ApiHeaders | null): Promise<Category[]> {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL is not defined');
  }

  if (!headers) {
    throw new Error('No valid headers available - session might not be initialized');
  }

  const response = await fetch(`${API_BASE_URL}/categories`, {
    headers: headers as HeadersInit
  });

  if (!response.ok) {
    throw new Error('Failed to fetch categories');
  }

  return response.json();
}
