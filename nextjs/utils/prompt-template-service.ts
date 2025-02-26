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

// Simple in-memory request tracker to prevent duplicate calls
// This is much simpler than a full cache system
const requestTracker: {
  [key: string]: boolean
} = {};

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
  if (!headers) {
    console.warn('No headers provided for fetchPromptTemplates');
    return [];
  }

  // Create a request key
  const requestKey = JSON.stringify(filters || {});
  
  // Check if we're already making this exact request
  if (requestTracker[requestKey]) {
    console.log(`Duplicate request prevented: ${requestKey}`);
    return [];
  }
  
  // Mark this request as in progress
  requestTracker[requestKey] = true;

  try {
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
    const templates = data.map((template: any) => {
      // Check for both possible favorite flags in the API response
      const isFavorite = template.is_favorite || template.is_favorited || false;
      
      return {
        ...template,
        id: template.id?.toString() || '',
        category_id: template.category_id?.toString(),
        default_persona_id: template.default_persona_id?.toString(),
        default_chat_model_id: template.default_chat_model_id?.toString(),
        // Set is_favorite flag based on API data
        is_favorite: isFavorite,
        tags: template.tags?.map((tag: any) => ({
          ...tag,
          id: tag.id?.toString() || ''
        })) || []
      };
    });
    
    // Log how many favorites we found
    console.log(`Mapped ${templates.length} templates with ${templates.filter((t: PromptTemplate) => t.is_favorite).length} favorites`);
    
    return templates;
  } catch (error) {
    console.error('Error in fetchPromptTemplates:', error);
    return [];
  } finally {
    // Clear the request tracker for this request
    setTimeout(() => {
      delete requestTracker[requestKey];
    }, 2000); // Prevent duplicate requests for 2 seconds
  }
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
    // Step 1: Fetch favorites first
    console.log('Fetching initial prompt templates - step 1: favorites');
    
    const favoriteFilters: PromptTemplateFilters = {
      favorited_by: userId,
      sort_by: 'created_at',
      sort_order: 'desc',
      limit: 10
    };
    
    // Construct URL for logging only
    const favoritesUrl = `${getApiUrl()}/prompt_templates/?favorited_by=${userId}&sort_by=created_at&sort_order=desc&limit=10`;
    console.log('Fetching favorites from:', favoritesUrl);
    
    const favorites = await fetchPromptTemplates(headers, favoriteFilters);
    console.log(`Fetched ${favorites.length} favorite prompt templates`);
    
    // Make sure all favorites have is_favorite set to true 
    // and capture any API is_favorited property
    const favoritesWithFlag = favorites.map(fav => ({
      ...fav,
      is_favorite: true,
      // Also make sure any API favorited flag is properly mapped
      ...(Object.prototype.hasOwnProperty.call(fav, 'is_favorited') && { is_favorite: true })
    }));
    
    console.log(`Processed ${favoritesWithFlag.length} favorites with proper flag`);
    
    // Step 2: Fetch recent templates
    console.log('Fetching initial prompt templates - step 2: recent');
    
    const recentFilters: PromptTemplateFilters = {
      sort_by: 'created_at',
      sort_order: 'desc',
      limit: 20
    };

    // Construct URL for logging only  
    const recentUrl = `${getApiUrl()}/prompt_templates/?sort_by=created_at&sort_order=desc&limit=20`;
    console.log('Fetching recent from:', recentUrl);
    
    const recent = await fetchPromptTemplates(headers, recentFilters);
    console.log(`Fetched ${recent.length} recent prompt templates`);
    
    // Process recent templates to ensure consistent is_favorite property
    const processedRecent = recent.map(template => ({
      ...template,
      // Set is_favorite based on the API's is_favorited property if it exists
      ...(Object.prototype.hasOwnProperty.call(template, 'is_favorited') && { 
        is_favorite: !!(template as any).is_favorited 
      })
    }));
    
    // Remove duplicates from recent that already exist in favorites
    const favoriteIds = new Set(favoritesWithFlag.map(f => f.id));
    const uniqueRecent = processedRecent.filter(template => !favoriteIds.has(template.id));
    console.log(`After filtering duplicates: ${uniqueRecent.length} unique recent templates`);
    
    // Combine favorites and non-duplicate recent items
    const combined = [...favoritesWithFlag, ...uniqueRecent];
    console.log(`Returning ${combined.length} total templates (${favoritesWithFlag.length} favorites + ${uniqueRecent.length} non-duplicated recent)`);
    console.log(`Final favorites count: ${combined.filter(t => t.is_favorite).length}`);
    
    return combined;
  } catch (error) {
    console.error('Error fetching initial prompt templates:', error);
    return [];
  }
}
