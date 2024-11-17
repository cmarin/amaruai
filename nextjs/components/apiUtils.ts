const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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