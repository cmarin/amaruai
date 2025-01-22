import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';

export type Tag = {
  id: string;
  name: string;
};

export async function fetchTags(headers?: ApiHeaders | null): Promise<Tag[]> {
  try {
    const requestHeaders = headers ? headers : {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('Fetching tags with headers:', requestHeaders);

    const response = await fetch(`${getApiUrl()}/tags`, {
      headers: requestHeaders as HeadersInit
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching tags:', response.status, errorText);
      throw new Error('Failed to fetch tags');
    }

    const data = await response.json();
    return data
      .map((tag: any) => ({
        ...tag,
        id: tag.id?.toString() || ''
      }))
      .sort((a: Tag, b: Tag) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching tags:', error);
    throw error;
  }
}

export async function createTag(name: string, headers?: ApiHeaders | null): Promise<Tag> {
  try {
    const requestHeaders = headers ? headers : {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    console.log('Creating tag with headers:', requestHeaders);
    
    // First, check if the tag already exists
    const existingTags = await fetchTags(headers);
    const existingTag = existingTags.find(tag => tag.name.toLowerCase() === name.toLowerCase());
    
    if (existingTag) {
      return existingTag;
    }

    const response = await fetch(`${getApiUrl()}/tags`, {
      method: 'POST',
      headers: requestHeaders as HeadersInit,
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error creating tag:', response.status, errorText);
      throw new Error('Failed to create tag');
    }

    const data = await response.json();
    return {
      ...data,
      id: data.id.toString()
    };
  } catch (error) {
    console.error('Error creating tag:', error);
    throw error;
  }
}

// Additional functions for updating and deleting tags can be added here if needed
