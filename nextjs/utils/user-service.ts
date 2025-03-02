import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl } from './api-utils';

// User model based on the provided schema
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  organization: string;
}

// Simple in-memory request tracker to prevent duplicate calls
const requestTracker: {
  [key: string]: boolean
} = {};

export async function fetchCurrentUser(headers: ApiHeaders): Promise<User> {
  // Create a request key
  const requestKey = 'currentUser';
  
  // Check if we're already making this exact request
  if (requestTracker[requestKey]) {
    console.log(`Duplicate request prevented: ${requestKey}`);
    // Return a promise that never resolves during the lock period
    // This will prevent the state from being updated with an empty result
    return new Promise((resolve) => {
      const checkLock = () => {
        if (!requestTracker[requestKey]) {
          // When the lock is released, try again
          fetchCurrentUser(headers).then(resolve);
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
  } catch (error) {
    console.error('Error fetching current user:', error);
    throw error;
  } finally {
    // Clear the request tracker after a delay
    setTimeout(() => {
      delete requestTracker[requestKey];
    }, 2000);
  }
} 