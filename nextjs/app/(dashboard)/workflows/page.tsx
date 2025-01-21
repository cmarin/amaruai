'use client'

import { useState, useEffect, useCallback } from 'react'
import { Workflow, fetchWorkflows, deleteWorkflow } from '@/utils/workflow-service'
import { useRouter } from 'next/navigation'
import { WorkflowManagerComponent } from '@/components/workflow-manager'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { useSession } from '@/app/utils/session/session';
import { WorkflowLibrary } from '@/components/workflow-library'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showWorkflowManager, setShowWorkflowManager] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null)
  const router = useRouter()
  const { sidebarOpen } = useSidebar()
  const { getApiHeaders, loading: sessionLoading } = useSession();

  const loadWorkflows = useCallback(async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      setIsLoading(true);
      const fetchedWorkflows = await fetchWorkflows(headers);
      setWorkflows(fetchedWorkflows);
      setError(null);
    } catch (err) {
      console.error('Error fetching workflows:', err);
      setError('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  }, [getApiHeaders]);

  useEffect(() => {
    if (!sessionLoading) {
      loadWorkflows();
    }
  }, [sessionLoading, loadWorkflows]);

  const handleNewWorkflow = () => {
    setSelectedWorkflow(null);
    setShowWorkflowManager(true);
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setShowWorkflowManager(true);
  };

  const handleDeleteClick = (workflow: Workflow) => {
    setWorkflowToDelete(workflow);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteConfirm = async () => {
    if (!workflowToDelete || !workflowToDelete.id) return;

    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      await deleteWorkflow(workflowToDelete.id, headers);
      await loadWorkflows();
      setShowDeleteConfirmation(false);
      setWorkflowToDelete(null);
    } catch (error) {
      console.error('Error deleting workflow:', error);
    }
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
        {showWorkflowManager ? (
          <div className="h-full w-full">
            <WorkflowManagerComponent
              workflow={selectedWorkflow}
              onCancel={() => setShowWorkflowManager(false)}
              onSave={loadWorkflows}
            />
          </div>
        ) : (
          <WorkflowLibrary
            workflows={workflows}
            onEdit={handleEditWorkflow}
            onDelete={handleDeleteClick}
            onNew={handleNewWorkflow}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        )}

        <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900">Are you sure you want to delete this workflow?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                This action cannot be undone. The workflow will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-100 text-gray-900 hover:bg-gray-200">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
