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

  useEffect(() => {
    const loadKnowledgeBase = async () => {
      try {
        const headers = getApiHeaders();
        if (!headers) return;

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/knowledge_bases/${params.id}`, {
          headers
        });

        if (!response.ok) {
          throw new Error('Failed to fetch knowledge base');
        }

        const data = await response.json();
        setKnowledgeBase(data);
      } catch (err) {
        console.error('Error loading knowledge base:', err);
        setError('Failed to load knowledge base');
      } finally {
        setIsLoading(false);
      }
    };

    loadKnowledgeBase();
  }, [params.id, getApiHeaders]);

  const handleSave = async () => {
    // Save logic here
    router.push('/knowledge-bases');
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