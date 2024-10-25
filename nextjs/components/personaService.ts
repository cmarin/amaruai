import { fetchWithRetry } from './apiUtils';
import { createTag, fetchTags, Tag } from './tagService';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type Persona = {
  id: number;
  role: string;
  goal: string;
  backstory: string;
  allow_delegation: boolean;
  verbose: boolean;
  memory: boolean;
  avatar: string | null;
  tools: { name: string; id: number; }[];
  categories: { name: string; id: number; }[];
  tags: Tag[];
  prompt_templates: { name: string; id: number; content: string; }[];
};

export async function fetchPersonas(): Promise<Persona[]> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/personas`);
    if (!response.ok) {
      throw new Error('Failed to fetch personas');
    }
    const data = await response.json();
    console.log('Fetched personas data:', data);
    return data;
  });
}

export async function createPersona(persona: Omit<Persona, 'id'>): Promise<Persona> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }

    // Fetch existing tags
    const existingTags = await fetchTags();
    console.log('Existing tags:', existingTags);

    // Process tags
    const processedTagIds = await Promise.all(persona.tags.map(async (tag) => {
      const existingTag = existingTags.find(t => t.name.toLowerCase() === tag.name.toLowerCase());
      if (existingTag) {
        console.log(`Using existing tag: ${existingTag.name} (ID: ${existingTag.id})`);
        return existingTag.id;
      } else {
        const newTag = await createTag(tag.name);
        console.log(`Created new tag: ${newTag.name} (ID: ${newTag.id})`);
        return newTag.id;
      }
    }));

    const payload = {
      ...persona,
      tag_ids: processedTagIds,
    };

    console.log('Creating persona with payload:', payload);
    console.log('POST URL:', `${API_URL}/personas`);

    const response = await fetch(`${API_URL}/personas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      throw new Error(`Failed to create persona: ${response.status} ${response.statusText}`);
    }

    const createdPersona = await response.json();
    console.log('Created persona:', createdPersona);
    return createdPersona;
  } catch (error) {
    console.error('Error creating persona:', error);
    throw error;
  }
}

export async function updatePersona(personaId: number, persona: Partial<Persona>): Promise<Persona> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }

    // Fetch existing tags
    const existingTags = await fetchTags();
    console.log('Existing tags:', existingTags);

    // Process tags
    const processedTagIds = await Promise.all(persona.tags?.map(async (tag) => {
      const existingTag = existingTags.find(t => t.name.toLowerCase() === tag.name.toLowerCase());
      if (existingTag) {
        console.log(`Using existing tag: ${existingTag.name} (ID: ${existingTag.id})`);
        return existingTag.id;
      } else {
        const newTag = await createTag(tag.name);
        console.log(`Created new tag: ${newTag.name} (ID: ${newTag.id})`);
        return newTag.id;
      }
    }) || []);

    const payload = {
      ...persona,
      tag_ids: processedTagIds,
    };

    console.log('Updating persona with payload:', payload);
    console.log('PUT URL:', `${API_URL}/personas/${personaId}`);

    const response = await fetch(`${API_URL}/personas/${personaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
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

export async function deletePersona(personaId: number): Promise<void> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    console.log('Deleting persona:', personaId);
    console.log('DELETE URL:', `${API_URL}/personas/${personaId}`);

    const response = await fetch(`${API_URL}/personas/${personaId}`, {
      method: 'DELETE',
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