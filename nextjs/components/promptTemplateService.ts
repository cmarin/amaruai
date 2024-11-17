// promptTemplateService.ts

import { createTag, fetchTags, Tag } from './tagService';
import { PromptContent } from './complex-prompt-editor';
import { fetchWithRetry } from './apiUtils';
import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from '@/lib/apiConfig';
import { Category } from './categoryService';

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

export type PromptTemplate = {
  id: number;
  title: string;
  description: string;
  prompt: string | PromptContent;
  is_complex: boolean;
  variables?: string[];
  category_id?: number;
  content?: string | PromptContent;
  // Add these new fields
  categories: Category[];
  tags: Tag[];
  category?: string;  // For form handling
  default_persona_id?: number | null;
};

export async function createPromptTemplate(
  promptTemplate: {
    title: string;
    prompt: string | PromptContent;
    is_complex: boolean;
    category_ids?: number[];
    tag_ids?: (number | string)[];
  },
  headers: ApiHeaders
): Promise<PromptTemplate> {
  try {
    if (!getApiUrl()) {
      throw new Error('API URL is not defined');
    }

    // Fetch existing tags with headers
    const existingTags = await fetchTags(headers);

    // Process tags with headers
    const processedTagIds = await Promise.all(promptTemplate.tag_ids?.map(async (tagId) => {
      if (typeof tagId === 'string') {
        const existingTag = existingTags.find(tag => tag.name.toLowerCase() === tagId.toLowerCase());
        if (existingTag) {
          return existingTag.id;
        } else {
          const newTag = await createTag(tagId, headers);
          return newTag.id;
        }
      }
      return tagId;
    }) || []);

    const payload = {
      ...promptTemplate,
      tag_ids: processedTagIds,
    };

    const response = await fetch(`${getApiUrl()}/prompt_templates`, {
      method: 'POST',
      headers: {
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to create prompt template: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating prompt template:', error);
    throw error;
  }
}

export async function updatePromptTemplate(
  promptTemplateId: number,
  promptTemplate: {
    title: string;
    prompt: string | PromptContent;
    is_complex: boolean;
    default_persona_id: number | null;
    category_ids: number[];
    tag_ids: (number | string)[];
  },
  headers: ApiHeaders
): Promise<PromptTemplate> {
  try {
    if (!getApiUrl()) {
      throw new Error('API URL is not defined');
    }

    // Fetch existing tags with headers
    const existingTags = await fetchTags(headers);

    // Process tags with headers
    const processedTagIds = await Promise.all(promptTemplate.tag_ids.map(async (tagId) => {
      if (typeof tagId === 'string') {
        const existingTag = existingTags.find(tag => tag.name.toLowerCase() === tagId.toLowerCase());
        if (existingTag) {
          return existingTag.id;
        } else {
          const newTag = await createTag(tagId, headers);
          return newTag.id;
        }
      }
      return tagId;
    }));

    const payload = {
      ...promptTemplate,
      tag_ids: processedTagIds,
    };

    console.log('Updating prompt template with payload:', payload);
    const response = await fetch(`${getApiUrl()}/prompt_templates/${promptTemplateId}`, {
      method: 'PUT',
      headers: {
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to update prompt template: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating prompt template:', error);
    throw error;
  }
}

export async function deletePromptTemplate(promptTemplateId: number, headers: ApiHeaders): Promise<void> {
  try {
    if (!getApiUrl()) {
      throw new Error('API URL is not defined');
    }
    const response = await fetch(`${getApiUrl()}/prompt_templates/${promptTemplateId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to delete prompt template: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting prompt template:', error);
    throw error;
  }
}

export async function fetchPromptTemplates(headers: ApiHeaders | null): Promise<PromptTemplate[]> {
  return fetchWithRetry(async () => {
    if (!getApiUrl()) {
      throw new Error('API URL is not defined');
    }

    if (!headers) {
      throw new Error('No valid headers available - session might not be initialized');
    }

    console.log('=== Fetching Prompt Templates ===');
    console.log('Request URL:', `${getApiUrl()}/prompt_templates`);
    console.log('Request Headers:', headers);
    console.log('Authorization Header:', headers.Authorization);
    console.log('========================');

    const response = await fetch(`${getApiUrl()}/prompt_templates`, {
      headers
    });

    console.log('Response Status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error Response:', errorText);
      throw new Error('Failed to fetch prompt templates');
    }

    const data = await response.json();
    console.log('Received Prompt Templates:', data);
    return data;
  });
}

export async function fetchPromptTemplate(id: number, headers: ApiHeaders): Promise<PromptTemplate> {
  try {
    if (!getApiUrl()) {
      throw new Error('API URL is not defined');
    }
    const response = await fetch(`${getApiUrl()}/prompt_templates/${id}`, {
      headers,
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error('Failed to fetch prompt template');
    }
    const data: PromptTemplate = await response.json();
    
    console.log('Fetched prompt template:', data);

    if (data.is_complex) {
      if (typeof data.prompt === 'string') {
        try {
          const parsedPrompt = JSON.parse(data.prompt);
          data.content = parsedPrompt;
          data.prompt = parsedPrompt;
        } catch (error) {
          console.error('Error parsing complex prompt:', error);
          data.is_complex = false;
        }
      } else if (typeof data.prompt === 'object') {
        data.content = data.prompt as PromptContent;
      }
    }
    
    console.log('Processed prompt template:', data);
    return data;
  } catch (error) {
    console.error('Error fetching prompt template:', error);
    throw error;
  }
}
