// promptTemplateService.ts

import { createTag, fetchTags, Tag } from './tagService';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

export interface PromptContent {
  variables: VariableType[];
  prompt: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface PromptTemplate {
  id: number;
  title: string;
  prompt: string | PromptContent;
  content?: PromptContent;
  is_complex: boolean;
  default_persona_id: number | null;
  categories: Category[];
  tags: Tag[];
  isFavorite?: boolean;
  isComplex?: boolean;
  category?: string;
}

export async function createPromptTemplate(promptTemplate: {
  title: string;
  prompt: string | PromptContent;
  is_complex: boolean;
  category_ids?: number[];
  tag_ids?: (number | string)[];
}): Promise<PromptTemplate> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }

    // Fetch existing tags
    const existingTags = await fetchTags();

    // Process tags
    const processedTagIds = await Promise.all(promptTemplate.tag_ids?.map(async (tagId) => {
      if (typeof tagId === 'string') {
        const existingTag = existingTags.find(tag => tag.name.toLowerCase() === tagId.toLowerCase());
        if (existingTag) {
          return existingTag.id;
        } else {
          const newTag = await createTag(tagId);
          return newTag.id;
        }
      }
      return tagId;
    }) || []);

    const payload = {
      ...promptTemplate,
      tag_ids: processedTagIds,
    };

    const response = await fetch(`${API_URL}/prompt_templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response:', errorData);
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
  }
): Promise<PromptTemplate> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }

    // Fetch existing tags
    const existingTags = await fetchTags();

    // Process tags
    const processedTagIds = await Promise.all(promptTemplate.tag_ids.map(async (tagId) => {
      if (typeof tagId === 'string') {
        const existingTag = existingTags.find(tag => tag.name.toLowerCase() === tagId.toLowerCase());
        if (existingTag) {
          return existingTag.id;
        } else {
          const newTag = await createTag(tagId);
          return newTag.id;
        }
      }
      return tagId;
    }));

    const payload = {
      ...promptTemplate,
      tag_ids: processedTagIds,
    };

    console.log('Sending payload:', JSON.stringify(payload, null, 2));
    const response = await fetch(`${API_URL}/prompt_templates/${promptTemplateId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response:', errorData);
      throw new Error(`Failed to update prompt template: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating prompt template:', error);
    throw error;
  }
}

export async function deletePromptTemplate(promptTemplateId: number): Promise<void> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/prompt_templates/${promptTemplateId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete prompt template');
    }
  } catch (error) {
    console.error('Error deleting prompt template:', error);
    throw error;
  }
}

export async function fetchPromptTemplates(): Promise<PromptTemplate[]> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/prompt_templates`);
    if (!response.ok) {
      throw new Error('Failed to fetch prompt templates');
    }
    const data: PromptTemplate[] = await response.json();
    console.log('Fetched prompt templates data:', data);

    const parsedData = data.map((promptTemplate: PromptTemplate) => {
      let content = promptTemplate.content;

      if (promptTemplate.is_complex) {
        if (!content && typeof promptTemplate.prompt === 'string') {
          try {
            const parsedPrompt = JSON.parse(promptTemplate.prompt);
            content = parsedPrompt.content || parsedPrompt;
          } catch (error) {
            content = undefined;
            console.warn(`Prompt ID ${promptTemplate.id} marked as complex but has invalid JSON. Marking as non-complex.`);
          }
        } else if (!content && typeof promptTemplate.prompt === 'object') {
          content = promptTemplate.prompt as PromptContent;
        }

        if (!content) {
          promptTemplate.is_complex = false;
        }
      } else {
        content = undefined;
      }

      return {
        ...promptTemplate,
        content,
      };
    });

    return parsedData;
  } catch (error) {
    console.error('Error fetching prompt templates:', error);
    throw error;
  }
}

export async function fetchPromptTemplate(id: number): Promise<PromptTemplate> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/prompt_templates/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch prompt template');
    }
    const data: PromptTemplate = await response.json();
    
    console.log('Fetched prompt template:', data);

    if (data.is_complex) {
      if (typeof data.prompt === 'string') {
        try {
          const parsedPrompt = JSON.parse(data.prompt);
          data.content = parsedPrompt;
          // Ensure the prompt field is also an object
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
