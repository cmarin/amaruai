// promptTemplateService.ts

import type { PromptContent } from '@/components/complex-prompt-editor';
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
  default_chat_model_id?: string | null;
  is_favorite: boolean;
}

export interface CreatePromptTemplateRequest {
  title: string;
  prompt: string | PromptContent;
  is_complex: boolean;
  category_ids?: string[];
  tags?: string[];  // Array of tag names
  default_persona_id?: string | null;
  default_chat_model_id?: string | null;
}

export interface UpdatePromptTemplateRequest {
  title: string;
  prompt: string | PromptContent;
  is_complex: boolean;
  category_ids?: string[];
  tags?: string[];  // Array of tag names
  default_persona_id?: string | null;
  default_chat_model_id?: string | null;
}

export interface PromptTemplateFilters {
  skip?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
  favorited_by?: string;
  has_favorites?: boolean;
  created_by?: string;
}

// Add cache for API responses
const templateCache: {
  [key: string]: {
    data: PromptTemplate[];
    timestamp: number;
  }
} = {};

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Helper to generate a cache key from API parameters
const getCacheKey = (filters?: PromptTemplateFilters): string => {
  if (!filters) return 'all';
  return JSON.stringify(filters);
};

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

    return await fetchWithRetry(async () => {
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
        throw new Error('Failed to create prompt template');
      }

      return response.json();
    });
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

    return await fetchWithRetry(async () => {
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
        throw new Error('Failed to update prompt template');
      }

      return response.json();
    });
  } catch (error) {
    console.error('Error in updatePromptTemplate:', error);
    throw error;
  }
}

export async function deletePromptTemplate(promptTemplateId: string, headers: ApiHeaders): Promise<void> {
  return await fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/prompt_templates/${promptTemplateId}`, {
      method: 'DELETE',
      headers,
    });

    if (response.status !== 204) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete prompt template');
    }
  });
}

export async function fetchPromptTemplates(
  headers: ApiHeaders | null,
  filters?: PromptTemplateFilters
): Promise<PromptTemplate[]> {
  // Generate cache key from the filters
  const cacheKey = getCacheKey(filters);
  
  // Check if we have a valid cached response
  const cached = templateCache[cacheKey];
  const now = Date.now();
  
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    console.log(`Using cached prompt templates for key: ${cacheKey}`);
    return cached.data;
  }

  return await fetchWithRetry(async () => {
    // Construct query parameters
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const queryString = queryParams.toString();
    const url = `${getApiUrl()}/prompt_templates/${queryString ? `?${queryString}` : ''}`;
    console.log(`Fetching prompt templates from: ${url}`);

    const response = await fetch(url, {
      headers: headers || {},
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching prompt templates:', response.status, errorText);
      throw new Error('Failed to fetch prompt templates');
    }

    const data = await response.json();
    const templates = data.map((template: any) => ({
      ...template,
      id: template.id?.toString() || '',
      category_id: template.category_id?.toString(),
      default_persona_id: template.default_persona_id?.toString(),
      default_chat_model_id: template.default_chat_model_id?.toString(),
      is_favorite: template.is_favorite || false,
      tags: template.tags?.map((tag: any) => ({
        ...tag,
        id: tag.id?.toString() || ''
      })) || []
    }));
    
    // Cache the response
    templateCache[cacheKey] = {
      data: templates,
      timestamp: now
    };
    
    return templates;
  });
}

export async function fetchPromptTemplate(promptTemplateId: string, headers: ApiHeaders): Promise<PromptTemplate> {
  return await fetchWithRetry(async () => {
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
      default_chat_model_id: data.default_chat_model_id?.toString(),
      is_favorite: data.is_favorite || false,
      tags: data.tags?.map((tag: any) => ({
        ...tag,
        id: tag.id?.toString() || ''
      })) || []
    };
  });
}

export async function favoritePromptTemplate(promptTemplateId: string, headers: ApiHeaders): Promise<void> {
  return await fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/prompt_templates/${promptTemplateId}/favorite`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error favoriting prompt template:', response.status, errorText);
      throw new Error('Failed to favorite prompt template');
    }
  });
}

export async function unfavoritePromptTemplate(promptTemplateId: string, headers: ApiHeaders): Promise<void> {
  return await fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/prompt_templates/${promptTemplateId}/unfavorite`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error unfavoriting prompt template:', response.status, errorText);
      throw new Error('Failed to unfavorite prompt template');
    }
  });
}

export async function fetchFavoritePromptTemplates(headers: ApiHeaders): Promise<PromptTemplate[]> {
  return await fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/prompt_templates/favorites`, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching favorite prompt templates:', response.status, errorText);
      throw new Error('Failed to fetch favorite prompt templates');
    }

    const data = await response.json();
    return data.map((template: any) => ({
      ...template,
      id: template.id?.toString() || '',
      category_id: template.category_id?.toString(),
      default_persona_id: template.default_persona_id?.toString(),
      default_chat_model_id: template.default_chat_model_id?.toString(),
      is_favorite: template.is_favorite || false,
      tags: template.tags?.map((tag: any) => ({
        ...tag,
        id: tag.id?.toString() || ''
      })) || []
    }));
  });
}

export async function fetchInitialPromptTemplates(
  headers: ApiHeaders | null,
  userId?: string
): Promise<PromptTemplate[]> {
  // If no headers or userId, return empty array
  if (!headers || !userId) {
    console.warn('No headers or userId provided for fetchInitialPromptTemplates');
    return [];
  }

  try {
    // Construct both request URLs for debugging
    const favoritesUrl = `${getApiUrl()}/prompt_templates/?favorited_by=${userId}&sort_by=created_at&sort_order=desc&limit=10`;
    const recentUrl = `${getApiUrl()}/prompt_templates/?sort_by=created_at&sort_order=desc&limit=20`;
    console.log('Fetching favorites from:', favoritesUrl);
    console.log('Fetching recent from:', recentUrl);

    // Step 1: Fetch up to 10 favorites
    const favoriteFilters: PromptTemplateFilters = {
      favorited_by: userId,
      sort_by: 'created_at',
      sort_order: 'desc',
      limit: 10
    };
    const favorites = await fetchPromptTemplates(headers, favoriteFilters);
    console.log(`Fetched ${favorites.length} favorite prompt templates`);
    
    // Make sure all favorites have is_favorite set to true
    const favoritesWithFlag = favorites.map(fav => ({
      ...fav,
      is_favorite: true
    }));
    
    // Step 2: Fetch up to 20 additional prompts
    const recentFilters: PromptTemplateFilters = {
      sort_by: 'created_at',
      sort_order: 'desc',
      limit: 20
    };
    const recent = await fetchPromptTemplates(headers, recentFilters);
    console.log(`Fetched ${recent.length} recent prompt templates`);
    
    // Step 3: Remove duplicates from recent that already exist in favorites
    const favoriteIds = new Set(favoritesWithFlag.map(f => f.id));
    const uniqueRecent = recent.filter(template => !favoriteIds.has(template.id));
    console.log(`After filtering duplicates: ${uniqueRecent.length} unique recent templates`);
    
    // Combine favorites and non-duplicate recent items
    const combined = [...favoritesWithFlag, ...uniqueRecent];
    console.log(`Returning ${combined.length} total templates (${favoritesWithFlag.length} favorites + ${uniqueRecent.length} non-duplicated recent)`);
    
    return combined;
  } catch (error) {
    console.error('Error fetching initial prompt templates:', error);
    return [];
  }
}
