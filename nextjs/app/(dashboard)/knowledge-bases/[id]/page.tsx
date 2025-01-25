'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KnowledgeBase, fetchKnowledgeBase } from '@/utils/knowledge-base-service';
import KnowledgeBaseManager from '@/components/knowledge-base-manager';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { useSession } from '@/app/utils/session/session';

export default function KnowledgeBasePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { getApiHeaders } = useSession();
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { sidebarOpen } = useSidebar();

  useEffect(() => {
    const loadKnowledgeBase = async () => {
      try {
        const headers = getApiHeaders();
        if (!headers) return;
        const data = await fetchKnowledgeBase(params.id, headers);
        setKnowledgeBase(data);
      } catch (error) {
        console.error('Error loading knowledge base:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadKnowledgeBase();
  }, [params.id, getApiHeaders]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <AppSidebar />
      <main className="flex-1">
        <KnowledgeBaseManager
          knowledgeBase={knowledgeBase}
          onSave={() => {
            router.refresh();
            router.push('/knowledge-bases');
          }}
          onClose={() => router.push('/knowledge-bases')}
        />
      </main>
    </>
  );
}