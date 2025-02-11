const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error('API URL not configured');
  }
  return apiUrl;
}

export function getFetchOptions(options: RequestInit = {}): RequestInit {
  // Basic headers that should be present in every request
  const defaultHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  // Merge headers, ensuring custom headers take precedence
  const headers = {
    ...defaultHeaders,
    ...options.headers,
  };

  // Basic fetch options
  const fetchOptions: RequestInit = {
    ...options,
    mode: 'cors',
    headers,
  };

  return fetchOptions;
}

export async function fetchWithRetry<T>(
  fetchFunction: () => Promise<T>,
  retryDelay: number = 2000,
  maxRetries: number = 1
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
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