import { fetchWithRetry } from './api-utils';
import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';
import { Asset } from '@/types/knowledge-base';

export async function fetchAssets(headers: ApiHeaders): Promise<Asset[]> {
  return fetchWithRetry(async () => {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }
    const response = await fetch(`${getApiUrl()}/assets`, {
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to fetch assets');
    }
    return response.json();
  });
}

export async function createAsset(file: File, headers: ApiHeaders): Promise<Asset> {
  try {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${getApiUrl()}/assets`, {
      method: 'POST',
      headers: {
        ...headers,
        // Don't set Content-Type here, let the browser set it with the boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to create asset: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating asset:', error);
    throw error;
  }
}

export async function deleteAsset(id: string, headers: ApiHeaders): Promise<void> {
  try {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }

    const response = await fetch(`${getApiUrl()}/assets/${id}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to delete asset: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting asset:', error);
    throw error;
  }
} 