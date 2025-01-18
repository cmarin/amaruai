'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KnowledgeBase } from '@/utils/knowledge-base-service';
import { KnowledgeBaseManager } from '@/components/knowledge-base-manager';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { useSession } from '@/app/utils/session/session';

export default function EditKnowledgeBasePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { sidebarOpen } = useSidebar();
  const { getApiHeaders } = useSession();

  const loadKnowledgeBase = async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) return;

      // First, fetch the knowledge base
      const kbResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/knowledge_bases/${params.id}`, {
        headers
      });

      if (!kbResponse.ok) {
        throw new Error('Failed to fetch knowledge base');
      }

      const kbData = await kbResponse.json();
      console.log('Knowledge Base API Response:', kbData);

      // Then fetch the associated assets
      const assetsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/knowledge_bases/${params.id}/assets`, {
        headers
      });

      if (!assetsResponse.ok) {
        throw new Error('Failed to fetch knowledge base assets');
      }

      const assetsData = await assetsResponse.json();
      console.log('Assets API Response:', assetsData);

      const knowledgeBaseWithAssets = {
        ...kbData,
        assets: assetsData || []
      };

      console.log('Final Knowledge Base with Assets:', knowledgeBaseWithAssets);
      setKnowledgeBase(knowledgeBaseWithAssets);
    } catch (err) {
      console.error('Error loading knowledge base:', err);
      setError('Failed to load knowledge base');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledgeBase();
  }, [params.id]);

  const handleSave = async () => {
    try {
      await loadKnowledgeBase();
      router.push('/knowledge-bases');
    } catch (error) {
      console.error('Error saving knowledge base:', error);
    }
  };

  const toggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <KnowledgeBaseManager
            knowledgeBase={knowledgeBase}
            onSave={handleSave}
            onClose={() => router.push('/knowledge-bases')}
          />
        </div>
      </div>
    </div>
  );
} 