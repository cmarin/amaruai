import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';

// Simple in-memory request tracker to prevent duplicate calls
const requestTracker: {
  [key: string]: boolean
} = {};

export type Category = {
  id: string;
  name: string;
  description: string;
};

export async function fetchCategories(headers: ApiHeaders): Promise<Category[]> {
  // Create a request key
  const requestKey = 'categories';
  
  // Check if we're already making this exact request
  if (requestTracker[requestKey]) {
    console.log(`Duplicate request prevented: ${requestKey}`);
    // Return a promise that never resolves during the lock period
    // This will prevent the state from being updated with an empty array
    return new Promise((resolve) => {
      const checkLock = () => {
        if (!requestTracker[requestKey]) {
          // When the lock is released, try again
          fetchCategories(headers).then(resolve);
        } else {
          // Check again after a short delay
          setTimeout(checkLock, 100);
        }
      };
      setTimeout(checkLock, 100);
    });
  }
  
  // Mark this request as in progress
  requestTracker[requestKey] = true;

  try {
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
  } finally {
    // Clear the request tracker after a delay
    setTimeout(() => {
      delete requestTracker[requestKey];
    }, 2000);
  }
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
  return {
    ...data,
    id: data.id.toString()
  };
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
  return {
    ...data,
    id: data.id.toString()
  };
}

export async function deleteCategory(id: string, headers: ApiHeaders): Promise<void> {
  const response = await fetch(`${getApiUrl()}/categories/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to delete category');
  }
}
