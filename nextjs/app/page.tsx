'use client'

import { ErrorBoundary } from 'react-error-boundary'
import { useData } from '../components/data-context'

function ErrorFallback({error}: {error: Error}) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
    </div>
  )
}

export default function Home() {
  const { isLoading, error } = useData();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div>Welcome to Amaru AI</div>
    </ErrorBoundary>
  )
}