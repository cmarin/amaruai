import { fetchWithRetry } from './api-utils';
import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';
import type { KnowledgeBase, KnowledgeBaseCreate } from '@/types/knowledge-base';

export type { KnowledgeBase, KnowledgeBaseCreate };

export async function fetchKnowledgeBases(headers: ApiHeaders): Promise<KnowledgeBase[]> {
  return fetchWithRetry(async () => {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }
    const response = await fetch(`${getApiUrl()}/knowledge_bases`, {
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to fetch knowledge bases');
    }
    return response.json();
  });
}

export async function createKnowledgeBase(knowledgeBase: KnowledgeBaseCreate, headers: ApiHeaders): Promise<KnowledgeBase> {
  try {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }

    const response = await fetch(`${getApiUrl()}/knowledge_bases`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(knowledgeBase),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to create knowledge base: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating knowledge base:', error);
    throw error;
  }
}

export const updateKnowledgeBase = async (id: string, data: KnowledgeBaseCreate, headers: HeadersInit) => {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    throw new Error('API_BASE_URL is not defined');
  }

  const response = await fetch(`${baseUrl}/knowledge_bases/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response:', response.status, errorText);
    throw new Error(`Failed to update knowledge base: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export async function deleteKnowledgeBase(id: string, headers: ApiHeaders): Promise<void> {
  try {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }

    const response = await fetch(`${getApiUrl()}/knowledge_bases/${id}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to delete knowledge base: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    throw error;
  }
} 