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
      console.log('loadKnowledgeBase called for ID:', params.id);
      const headers = getApiHeaders();
      console.log('API Headers:', headers);
      
      if (!headers) {
        console.error('No API headers available');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, ''); // Remove trailing slash if present
      console.log('Base API URL:', apiUrl);
      
      if (!apiUrl) {
        console.error('API URL is not defined');
        return;
      }

      const kbUrl = `${apiUrl}/knowledge_bases/${params.id}`;
      console.log('Fetching knowledge base from:', kbUrl);

      // First, fetch the knowledge base
      const kbResponse = await fetch(kbUrl, {
        headers,
        cache: 'no-store' // Disable caching
      });

      if (!kbResponse.ok) {
        const errorText = await kbResponse.text();
        console.error('Knowledge base fetch failed:', {
          status: kbResponse.status,
          statusText: kbResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to fetch knowledge base: ${errorText}`);
      }

      const kbData = await kbResponse.json();
      console.log('Raw Knowledge Base API Response:', kbData);
      if (!kbData.title) {
        console.warn('Knowledge base data is missing title:', kbData);
      }

      // Then fetch the associated assets
      const assetsUrl = `${apiUrl}/knowledge_bases/${params.id}/assets`;
      console.log('Fetching assets from:', assetsUrl);

      const assetsResponse = await fetch(assetsUrl, {
        headers,
        cache: 'no-store' // Disable caching
      });

      if (!assetsResponse.ok) {
        const errorText = await assetsResponse.text();
        console.error('Assets fetch failed:', {
          status: assetsResponse.status,
          statusText: assetsResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to fetch knowledge base assets: ${errorText}`);
      }

      const assetsData = await assetsResponse.json();
      console.log('Raw Assets API Response:', assetsData);
      if (!Array.isArray(assetsData)) {
        console.warn('Assets data is not an array:', assetsData);
      }

      const knowledgeBaseWithAssets = {
        ...kbData,
        assets: assetsData || []
      };

      console.log('Final Knowledge Base State:', knowledgeBaseWithAssets);
      setKnowledgeBase(knowledgeBaseWithAssets);
      console.log('State updated with knowledge base');
    } catch (err) {
      console.error('Error loading knowledge base:', err);
      setError('Failed to load knowledge base');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('useEffect triggered with ID:', params.id);
    loadKnowledgeBase();
  }, [params.id, getApiHeaders]);

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