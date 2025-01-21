import { fetchWithRetry } from './api-utils';
import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';
import { Asset } from '@/types/knowledge-base';

export async function fetchAssets(headers: ApiHeaders): Promise<Asset[]> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/assets`, {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch assets');
    }
    const data = await response.json();
    return data.map((asset: any) => ({
      ...asset,
      id: asset.id.toString()
    }));
  });
}

export async function fetchAsset(id: string, headers: ApiHeaders): Promise<Asset> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/assets/${id}`, {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch asset');
    }
    const asset = await response.json();
    return {
      ...asset,
      id: asset.id.toString()
    };
  });
}

export async function createAsset(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at'>, headers: ApiHeaders): Promise<Asset> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/assets`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(asset),
    });
    if (!response.ok) {
      throw new Error('Failed to create asset');
    }
    const data = await response.json();
    return {
      ...data,
      id: data.id.toString()
    };
  });
}

export async function updateAsset(id: string, asset: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>, headers: ApiHeaders): Promise<Asset> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/assets/${id}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(asset),
    });
    if (!response.ok) {
      throw new Error('Failed to update asset');
    }
    const data = await response.json();
    return {
      ...data,
      id: data.id.toString()
    };
  });
}

export async function deleteAsset(id: string, headers: ApiHeaders): Promise<void> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/assets/${id}`, {
      method: 'DELETE',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to delete asset');
    }
  });
}