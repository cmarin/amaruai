const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error('API URL not configured');
  }

  // Use URL object to ensure correct protocol
  const url = new URL(apiUrl);
  if (url.hostname === 'localhost') {
    url.protocol = 'http:';
  } else {
    url.protocol = 'https:';
  }

  console.log('getApiUrl:', url.toString());
  return url.toString();
}

export function getFetchOptions(options: RequestInit = {}): RequestInit {
  const isLocalhost = process.env.NEXT_PUBLIC_API_URL?.includes('localhost');
  
  return {
    ...options,
    // Disable SSL verification for localhost
    ...(isLocalhost && {
      mode: 'cors',
      credentials: 'include',
      rejectUnauthorized: false,
    }),
  };
}

export async function fetchWithRetry<T>(
  fetchFunction: () => Promise<T>,
  retryDelay: number = 2000,
  maxRetries: number = 1
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log('Attempting fetch with URL:', fetchFunction.toString());
      return await fetchFunction();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        console.warn(`API request failed, retrying in ${retryDelay}ms...`, error);
        await delay(retryDelay);
      }
    }
  }

  console.error('API request failed after retries:', lastError);
  throw lastError;
}