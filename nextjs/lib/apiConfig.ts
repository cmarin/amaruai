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