'use client'

import { useState, useEffect, useCallback } from 'react'
import { Workflow, fetchWorkflows, deleteWorkflow } from '@/utils/workflow-service'
import { useRouter } from 'next/navigation'
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
    router.push('/workflows/new');
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    if (workflow.id) {
      router.push(`/workflows/${workflow.id}`);
    }
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
        <WorkflowLibrary
          workflows={workflows}
          onEdit={handleEditWorkflow}
          onDelete={handleDeleteClick}
          onNew={handleNewWorkflow}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
          <AlertDialogContent className="bg-white dark:bg-gray-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900 dark:text-gray-100">Are you sure you want to delete this workflow?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                This action cannot be undone. The workflow will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">Cancel</AlertDialogCancel>
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
