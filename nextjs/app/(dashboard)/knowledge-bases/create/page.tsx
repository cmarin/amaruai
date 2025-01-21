'use client';

import { useRouter } from 'next/navigation';
import KnowledgeBaseManager from '@/components/knowledge-base-manager';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';

export default function CreateKnowledgeBasePage() {
  const router = useRouter();
  const { sidebarOpen } = useSidebar();

  const toggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  };

  const handleSave = async () => {
    // Save logic here
    router.push('/knowledge-bases');
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <KnowledgeBaseManager
            knowledgeBase={null}
            onSave={() => {
              handleSave();
              router.push('/knowledge-bases');
            }}
            onClose={() => router.push('/knowledge-bases')}
          />
        </div>
      </div>
    </div>
  );
}