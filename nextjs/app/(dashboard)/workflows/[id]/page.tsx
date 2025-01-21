'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Workflow, fetchWorkflow } from '@/utils/workflow-service';
import { WorkflowManagerComponent } from '@/components/workflow-manager';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { useSession } from '@/app/utils/session/session';

export default function EditWorkflowPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { sidebarOpen } = useSidebar();
  const { getApiHeaders } = useSession();

  const loadWorkflow = async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      const fetchedWorkflow = await fetchWorkflow(params.id, headers);
      setWorkflow(fetchedWorkflow);
      setError(null);
    } catch (err) {
      console.error('Error fetching workflow:', err);
      setError('Failed to load workflow');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflow();
  }, [params.id]);

  const handleSave = async () => {
    router.push('/workflows');
  };

  const handleCancel = () => {
    router.push('/workflows');
  };

  const toggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <main className={`flex-1 min-h-screen transition-all duration-300 ${sidebarOpen ? 'ml-56' : 'ml-14'}`}>
          Loading...
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <main className={`flex-1 min-h-screen transition-all duration-300 ${sidebarOpen ? 'ml-56' : 'ml-14'}`}>
          {error}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar toggleChatbot={toggleChatbot} />
      <main className={`flex-1 min-h-screen transition-all duration-300 ${sidebarOpen ? 'ml-56' : 'ml-14'}`}>
        <div className="h-full w-full">
          <WorkflowManagerComponent
            workflow={workflow}
            onCancel={handleCancel}
            onSave={handleSave}
          />
        </div>
      </main>
    </div>
  );
}
