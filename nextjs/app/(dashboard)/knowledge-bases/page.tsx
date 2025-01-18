'use client';

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation';
import { fetchKnowledgeBases, KnowledgeBase, deleteKnowledgeBase } from '@/utils/knowledge-base-service'
import { KnowledgeBaseLibrary } from '@/components/knowledge-base-library'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { useSession } from '@/app/utils/session/session';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, Plus } from 'lucide-react';

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

  const handleCreateKnowledgeBase = () => {
    router.push('/knowledge-bases/create');
  };

  if (sessionLoading || isLoading) return <div>Loading knowledge bases...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="flex items-center justify-between p-4 border-b bg-white">
            <h1 className="text-2xl font-bold">Knowledge Base Library</h1>
            <div className="flex gap-3">
              <Link href="/assets">
                <Button 
                  variant="outline" 
                  className="h-10 flex items-center"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Manage Assets
                </Button>
              </Link>
              <Button 
                onClick={handleCreateKnowledgeBase} 
                className="bg-blue-600 hover:bg-blue-700 text-white h-10"
              >
                <Plus className="mr-2 h-4 w-4" />
                Knowledge Base
              </Button>
            </div>
          </div>
          <KnowledgeBaseLibrary
            knowledgeBases={knowledgeBases}
            onUpdateKnowledgeBases={handleUpdateKnowledgeBases}
          />
        </div>
      </div>
    </div>
  )
} 