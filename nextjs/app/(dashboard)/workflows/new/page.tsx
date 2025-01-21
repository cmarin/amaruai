'use client';

import { useRouter } from 'next/navigation';
import { WorkflowManagerComponent } from '@/components/workflow-manager';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';

export default function NewWorkflowPage() {
  const router = useRouter();
  const { sidebarOpen } = useSidebar();

  const handleSave = async () => {
    router.push('/workflows');
  };

  const handleCancel = () => {
    router.push('/workflows');
  };

  const toggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  };

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar toggleChatbot={toggleChatbot} />
      <main className={`flex-1 min-h-screen transition-all duration-300 ${sidebarOpen ? 'ml-56' : 'ml-14'}`}>
        <div className="h-full w-full">
          <WorkflowManagerComponent
            workflow={null}
            onCancel={handleCancel}
            onSave={handleSave}
          />
        </div>
      </main>
    </div>
  );
}
