// promptTemplateService.ts

import { PromptContent } from '@/components/complex-prompt-editor';
import { getApiUrl, fetchWithRetry } from './api-utils';
import { ApiHeaders } from '@/app/utils/session/session';
import { Category } from '@/utils/category-service';

export interface VariableType {
  fieldName: string;
  required: boolean;
  controlType: string;
  placeholder?: string;
  options?: string[];
  preselectedOption?: string | string[];
  tooltip?: string;
  validation?: {
    min?: number;
    max?: number;
    step?: number;
  };
}

export interface Tag {
  id: string;
  name: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string | PromptContent;
  is_complex: boolean;
  variables?: string[];
  category_id?: string;
  content?: string | PromptContent;
  categories: Category[];
  tags: Tag[];
  category?: string;  // For form handling
  default_persona_id?: string | null;
  is_favorite?: boolean;
}

export interface CreatePromptTemplateRequest {
  title: string;
  prompt: string | PromptContent;
  is_complex: boolean;
  category_ids?: string[];
  tags?: string[];  // Array of tag names
}

export interface UpdatePromptTemplateRequest {
  title: string;
  prompt: string | PromptContent;
  is_complex: boolean;
  default_persona_id: string | null;
  category_ids: string[];
  tags: string[];  // Array of tag names
}

export async function createPromptTemplate(
  promptTemplate: CreatePromptTemplateRequest,
  headers: ApiHeaders
): Promise<PromptTemplate> {
  try {
    if (!getApiUrl()) {
      throw new Error('API URL is not defined');
    }

    // Convert to API format
    const payload = {
      ...promptTemplate,
      tags: promptTemplate.tags || []  // Ensure tags is present
    };

    const response = await fetch(`${getApiUrl()}/prompt_templates`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to create prompt template: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data,
      id: data.id?.toString() || '',
      category_id: data.category_id?.toString(),
      default_persona_id: data.default_persona_id?.toString(),
      tags: data.tags?.map((tag: any) => ({
        ...tag,
        id: tag.id?.toString() || ''
      })) || []
    };
  } catch (error) {
    console.error('Error in createPromptTemplate:', error);
    throw error;
  }
}

export async function updatePromptTemplate(
  promptTemplateId: string,
  promptTemplate: UpdatePromptTemplateRequest,
  headers: ApiHeaders
): Promise<PromptTemplate> {
  try {
    // Convert to API format
    const payload = {
      ...promptTemplate,
      tags: promptTemplate.tags || []  // Ensure tags is present
    };

    const response = await fetch(`${getApiUrl()}/prompt_templates/${promptTemplateId}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to update prompt template: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data,
      id: data.id?.toString() || '',
      category_id: data.category_id?.toString(),
      default_persona_id: data.default_persona_id?.toString(),
      tags: data.tags?.map((tag: any) => ({
        ...tag,
        id: tag.id?.toString() || ''
      })) || []
    };
  } catch (error) {
    console.error('Error in updatePromptTemplate:', error);
    throw error;
  }
}

export async function deletePromptTemplate(promptTemplateId: string, headers: ApiHeaders): Promise<void> {
  const response = await fetch(`${getApiUrl()}/prompt_templates/${promptTemplateId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response:', response.status, errorText);
    throw new Error(`Failed to delete prompt template: ${response.status} ${response.statusText}`);
  }
}

export async function fetchPromptTemplates(headers: ApiHeaders | null): Promise<PromptTemplate[]> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/prompt_templates`, {
      headers: headers || {},
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching prompt templates:', response.status, errorText);
      throw new Error('Failed to fetch prompt templates');
    }

    const data = await response.json();
    return data.map((template: any) => ({
      ...template,
      id: template.id?.toString() || '',
      category_id: template.category_id?.toString(),
      default_persona_id: template.default_persona_id?.toString(),
      tags: template.tags?.map((tag: any) => ({
        ...tag,
        id: tag.id?.toString() || ''
      })) || []
    }));
  });
}

export async function fetchPromptTemplate(promptTemplateId: string, headers: ApiHeaders): Promise<PromptTemplate> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/prompt_templates/${promptTemplateId}`, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching prompt template:', response.status, errorText);
      throw new Error('Failed to fetch prompt template');
    }

    const data = await response.json();
    return {
      ...data,
      id: data.id?.toString() || '',
      category_id: data.category_id?.toString(),
      default_persona_id: data.default_persona_id?.toString(),
      tags: data.tags?.map((tag: any) => ({
        ...tag,
        id: tag.id?.toString() || ''
      })) || []
    };
  });
}

export async function favoritePromptTemplate(promptTemplateId: string, headers: ApiHeaders): Promise<void> {
  const apiUrl = getApiUrl();
  try {
    const response = await fetchWithRetry(
      async () => {
        const res = await fetch(`${apiUrl}/api/v1/prompt_templates/${promptTemplateId}/favorite`, {
          method: 'POST',
          headers: {
            ...headers,
          },
        });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res;
      }
    );
  } catch (error) {
    console.error('Error in favoritePromptTemplate:', error);
    throw error;
  }
}

export async function unfavoritePromptTemplate(promptTemplateId: string, headers: ApiHeaders): Promise<void> {
  const apiUrl = getApiUrl();
  try {
    const response = await fetchWithRetry(
      async () => {
        const res = await fetch(`${apiUrl}/api/v1/prompt_templates/${promptTemplateId}/favorite`, {
          method: 'DELETE',
          headers: {
            ...headers,
          },
        });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res;
      }
    );
  } catch (error) {
    console.error('Error in unfavoritePromptTemplate:', error);
    throw error;
  }
}

export async function fetchFavoritePromptTemplates(headers: ApiHeaders): Promise<PromptTemplate[]> {
  const apiUrl = getApiUrl();
  try {
    const response = await fetchWithRetry(
      async () => {
        const res = await fetch(`${apiUrl}/api/v1/prompt_templates/favorites`, {
          method: 'GET',
          headers: {
            ...headers,
          },
        });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res;
      }
    );

    const data = await response.json();
    return data as PromptTemplate[];
  } catch (error) {
    console.error('Error in fetchFavoritePromptTemplates:', error);
    throw error;
  }
}
