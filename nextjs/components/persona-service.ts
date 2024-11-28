import { fetchWithRetry } from './api-utils';
import { createTag, fetchTags, Tag } from './tag-service';
import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from '@/lib/apiConfig';

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

export type PersonaCreate = Omit<Persona, 'id'>;

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

export async function createPersona(persona: PersonaCreate, headers: ApiHeaders): Promise<Persona> {
  try {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }

    // Process tags with headers
    const existingTags = await fetchTags(headers);
    const processedTagIds = await Promise.all(persona.tags.map(async (tag: Tag) => {
      const existingTag = existingTags.find(t => t.name.toLowerCase() === tag.name.toLowerCase());
      if (existingTag) {
        return existingTag.id;
      } else {
        const newTag = await createTag(tag.name, headers);
        return newTag.id;
      }
    }));

    const payload = {
      ...persona,
      tag_ids: processedTagIds,
    };

    console.log('Creating persona with payload:', payload);

    const response = await fetch(`${getApiUrl()}/personas`, {
      method: 'POST',
      headers: {
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to create persona: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating persona:', error);
    throw error;
  }
}

export async function updatePersona(personaId: number, persona: Partial<Persona>, headers: ApiHeaders): Promise<Persona> {
  try {
    if (!getApiUrl()) {
      throw new Error('API_BASE_URL is not defined');
    }

    // Pass headers to fetchTags
    const existingTags = await fetchTags(headers);
    console.log('Existing tags:', existingTags);

    // Process tags with headers
    const processedTagIds = await Promise.all(persona.tags?.map(async (tag: Tag) => {
      const existingTag = existingTags.find(t => t.name.toLowerCase() === tag.name.toLowerCase());
      if (existingTag) {
        console.log(`Using existing tag: ${existingTag.name} (ID: ${existingTag.id})`);
        return existingTag.id;
      } else {
        // Pass headers to createTag
        const newTag = await createTag(tag.name, headers);
        console.log(`Created new tag: ${newTag.name} (ID: ${newTag.id})`);
        return newTag.id;
      }
    }) || []);

    const payload = {
      ...persona,
      tag_ids: processedTagIds,
    };

    console.log('Updating persona with payload:', payload);
    console.log('PUT URL:', `${getApiUrl()}/personas/${personaId}`);

    const response = await fetch(`${getApiUrl()}/personas/${personaId}`, {
      method: 'PUT',
      headers: {
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to update persona: ${response.status} ${response.statusText}`);
    }

    const updatedPersona = await response.json();
    console.log('Updated persona:', updatedPersona);
    return updatedPersona;
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
