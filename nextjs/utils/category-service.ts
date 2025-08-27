import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';
import { cachedRequest, invalidateCache } from './api-request-manager';

export type Category = {
  id: string;
  name: string;
  description: string;
};

export async function fetchCategories(headers: ApiHeaders): Promise<Category[]> {
  return cachedRequest(
    'categories',
    async () => {
      const response = await fetch(`${getApiUrl()}/categories/?limit=30`, {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }

      const data = await response.json();
      return data.map((category: any) => ({
        ...category,
        id: category.id?.toString() || ''
      }));
    },
    {
      ttl: 30, // Cache for 30 minutes
      debug: process.env.NODE_ENV === 'development'
    }
  );
}

export async function createCategory(category: Omit<Category, 'id'>, headers: ApiHeaders): Promise<Category> {
  const response = await fetch(`${getApiUrl()}/categories`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(category),
  });

  if (!response.ok) {
    throw new Error('Failed to create category');
  }

  const data = await response.json();
  const result = {
    ...data,
    id: data.id.toString()
  };

  // Invalidate categories cache after successful creation
  invalidateCache(/^categories/);
  
  return result;
}

export async function updateCategory(id: string, category: Partial<Category>, headers: ApiHeaders): Promise<Category> {
  const response = await fetch(`${getApiUrl()}/categories/${id}`, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(category),
  });

  if (!response.ok) {
    throw new Error('Failed to update category');
  }

  const data = await response.json();
  const result = {
    ...data,
    id: data.id.toString()
  };

  // Invalidate categories cache after successful update
  invalidateCache(/^categories/);
  
  return result;
}

export async function deleteCategory(id: string, headers: ApiHeaders): Promise<void> {
  const response = await fetch(`${getApiUrl()}/categories/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to delete category');
  }

  // Invalidate categories cache after successful deletion
  invalidateCache(/^categories/);
}
