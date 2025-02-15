'use client';

import { useRouter } from 'next/navigation';
import KnowledgeBaseManager from '@/components/knowledge-base-manager';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { createKnowledgeBase } from '@/utils/knowledge-base-service';
import { KnowledgeBaseCreate } from '@/types/knowledge-base';
import { useSession } from '@/app/utils/session/session';
import { useToast } from '@/hooks/use-toast';

export default function CreateKnowledgeBasePage() {
  const router = useRouter();
  const { sidebarOpen } = useSidebar();
  const { getApiHeaders } = useSession();
  const { toast } = useToast();

  const toggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  };

  const handleSave = async (data: KnowledgeBaseCreate) => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        toast({
          title: "Error",
          description: "You must be logged in to create a knowledge base",
          variant: "destructive",
        });
        return;
      }
      
      // Create the knowledge base
      await createKnowledgeBase(data, headers);
      
      toast({
        title: "Success",
        description: "Knowledge base created successfully",
      });
      
      router.push('/knowledge-bases');
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      toast({
        title: "Error",
        description: "Failed to create knowledge base",
        variant: "destructive",
      });
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