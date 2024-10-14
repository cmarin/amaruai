'use client'

import { MultiAiChat } from '../components/multi-ai-chat'
import { ErrorBoundary } from 'react-error-boundary'
import { useData } from '../components/DataContext'

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
      <MultiAiChat />
    </ErrorBoundary>
  )
}