const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type Category = {
  id: number;
  name: string;
};

export async function fetchCategories(): Promise<Category[]> {
  try {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/categories`);
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    const data = await response.json();
    return data.sort((a: Category, b: Category) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}