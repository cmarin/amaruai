'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/app/utils/session/session';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';
import KnowledgeBaseManager from '@/components/knowledge-base-manager';
import { useToast } from '@/hooks/use-toast';

export default function CreateKnowledgeBasePage() {
  const router = useRouter();
  const { sidebarOpen } = useSidebar();
  const { getApiHeaders } = useSession();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const toggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      router.push('/knowledge-bases');
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      toast({
        title: "Error",
        description: "Failed to create knowledge base",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <KnowledgeBaseManager
            knowledgeBase={null}
            onSave={handleSave}
            onClose={() => router.push('/knowledge-bases')}
          />
        </div>
      </div>
    </div>
  );
}