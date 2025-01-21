'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const { getApiHeaders, loading: sessionLoading } = useSession();

  const loadWorkflow = useCallback(async () => {
    try {
      console.log('Loading workflow with ID:', params.id);
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      console.log('Headers available, fetching workflow...');

      const fetchedWorkflow = await fetchWorkflow(params.id, headers);
      console.log('Fetched workflow:', fetchedWorkflow);
      setWorkflow(fetchedWorkflow);
      setError(null);
    } catch (err) {
      console.error('Error fetching workflow:', err);
      setError('Failed to load workflow');
    } finally {
      setIsLoading(false);
    }
  }, [params.id, getApiHeaders]);

  useEffect(() => {
    console.log('Edit workflow page mounted, session loading:', sessionLoading);
    if (!sessionLoading) {
      loadWorkflow();
    }
  }, [sessionLoading, loadWorkflow]);

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
          Loading workflow...
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
