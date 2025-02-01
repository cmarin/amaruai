import { fetchWithRetry } from './api-utils';
import { createTag, fetchTags, Tag } from './tag-service';
import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';

export type Persona = {
  id: string | number;
  role: string;
  goal: string;
  backstory: string;
  description: string;
  allow_delegation: boolean;
  verbose: boolean;
  memory: boolean;
  avatar: string | null;
  tools: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string }>;
  tags: Tag[];
  prompt_templates: any[];
  created_at: string;
  updated_at: string;
};

export type PersonaCreate = {
  role: string;
  goal: string;
  backstory: string;
  description: string;
  allow_delegation: boolean;
  verbose: boolean;
  memory: boolean;
  avatar: string | null;
  tools: Array<{ id: number; name: string }>;
  category_ids: string[];
  tags: string[];
  prompt_templates: any[];
};

export type PersonaUpdate = Omit<PersonaCreate, 'prompt_templates'>;

export async function fetchPersonas(headers: ApiHeaders): Promise<Persona[]> {
  return fetchWithRetry(async () => {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }
    const response = await fetch(`${getApiUrl()}/personas`, {
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to fetch personas');
    }
    return response.json();
  });
}

export async function fetchPersona(id: string, headers: Record<string, string>): Promise<Persona> {
  const response = await fetch(`${getApiUrl()}/personas/${id}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch persona');
  }

  return response.json();
}

export async function createPersona(persona: PersonaCreate, headers: ApiHeaders): Promise<Persona> {
  try {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }

    const payload = {
      ...persona,
      tags: persona.tags || [],
      category_ids: persona.category_ids || [],
    };

    console.log('Creating persona with payload:', payload);

    const response = await fetch(`${getApiUrl()}/personas`, {
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
      throw new Error(`Failed to create persona: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data,
      id: data.id?.toString() || '',
      categories: data.categories?.map((cat: any) => ({
        ...cat,
        id: cat.id?.toString() || ''
      })) || [],
      tags: data.tags?.map((tag: any) => ({
        ...tag,
        id: tag.id?.toString() || ''
      })) || []
    };
  } catch (error) {
    console.error('Error creating persona:', error);
    throw error;
  }
}

export async function updatePersona(personaId: string, persona: PersonaUpdate, headers: ApiHeaders): Promise<Persona> {
  try {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }

    const payload = {
      ...persona,
      tags: persona.tags || [],
      category_ids: persona.category_ids || [],
    };

    console.log('Updating persona with payload:', payload);

    const response = await fetch(`${getApiUrl()}/personas/${personaId}`, {
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
      throw new Error(`Failed to update persona: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data,
      id: data.id?.toString() || '',
      categories: data.categories?.map((cat: any) => ({
        ...cat,
        id: cat.id?.toString() || ''
      })) || [],
      tags: data.tags?.map((tag: any) => ({
        ...tag,
        id: tag.id?.toString() || ''
      })) || []
    };
  } catch (error) {
    console.error('Error updating persona:', error);
    throw error;
  }
}

export async function deletePersona(personaId: number, headers: ApiHeaders): Promise<void> {
  try {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }
    console.log('Deleting persona:', personaId);
    console.log('DELETE URL:', `${getApiUrl()}/personas/${personaId}`);

    const response = await fetch(`${getApiUrl()}/personas/${personaId}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to delete persona: ${response.status} ${response.statusText}`);
    }
    console.log('Persona deleted successfully');
  } catch (error) {
    console.error('Error deleting persona:', error);
    throw error;
  }
}
