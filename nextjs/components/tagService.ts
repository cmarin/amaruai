const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type Tag = {
  id: number;
  name: string;
};

export async function fetchTags(): Promise<Tag[]> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/tags`);
    if (!response.ok) {
      throw new Error('Failed to fetch tags');
    }
    const data = await response.json();
    return data.sort((a: Tag, b: Tag) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching tags:', error);
    throw error;
  }
}

export async function createTag(name: string): Promise<Tag> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    
    // First, check if the tag already exists
    const existingTags = await fetchTags();
    const existingTag = existingTags.find(tag => tag.name.toLowerCase() === name.toLowerCase());
    
    if (existingTag) {
      return existingTag;
    }
    
    // If the tag doesn't exist, create a new one
    const response = await fetch(`${API_URL}/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create tag');
    }
    
    const newTag = await response.json();
    return newTag;
  } catch (error) {
    console.error('Error creating tag:', error);
    throw error;
  }
}

// Additional functions for updating and deleting tags can be added here if needed