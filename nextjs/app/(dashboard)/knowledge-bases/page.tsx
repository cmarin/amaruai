'use client';

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation';
import { fetchKnowledgeBases, KnowledgeBase, deleteKnowledgeBase } from '@/utils/knowledge-base-service'
import { KnowledgeBaseLibrary } from '@/components/knowledge-base-library'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { useSession } from '@/app/utils/session/session';

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { sidebarOpen } = useSidebar()
  const { getApiHeaders, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading) {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      fetchKnowledgeBases(headers)
        .then((data) => {
          setKnowledgeBases(data);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching knowledge bases:', err);
          setError('Failed to load knowledge bases');
          setIsLoading(false);
        });
    }
  }, [sessionLoading, getApiHeaders]);

  const handleUpdateKnowledgeBases = async () => {
    const headers = getApiHeaders();
    if (!headers) {
      console.error('No valid headers available');
      return;
    }
    try {
      const updatedKnowledgeBases = await fetchKnowledgeBases(headers);
      setKnowledgeBases(updatedKnowledgeBases);
    } catch (err) {
      console.error('Error updating knowledge bases:', err);
      setError('Failed to update knowledge bases');
    }
  };

  const toggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  };

  if (sessionLoading || isLoading) return <div>Loading knowledge bases...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <KnowledgeBaseLibrary
            knowledgeBases={knowledgeBases}
            onUpdateKnowledgeBases={handleUpdateKnowledgeBases}
          />
        </div>
      </div>
    </div>
  )
} 