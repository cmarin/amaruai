import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';
import { cachedRequest } from './api-request-manager';

// User model based on the provided schema
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  organization: string;
}

export async function fetchCurrentUser(headers: ApiHeaders): Promise<User> {
  return cachedRequest(
    'users/me',
    async () => {
      const response = await fetch(`${getApiUrl()}/users/me`, {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch current user');
      }

      const data = await response.json();
      return {
        ...data,
        id: data.id?.toString() || '',
        // Ensure active is a boolean
        active: data.active === true
      };
    },
    {
      ttl: 30, // Cache for 30 minutes
      debug: process.env.NODE_ENV === 'development'
    }
  );
} 