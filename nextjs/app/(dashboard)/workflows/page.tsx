'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Workflow, fetchWorkflows, deleteWorkflow } from '@/utils/workflow-service'
import { Badge } from "@/components/ui/badge"
import { useRouter } from 'next/navigation'
import { WorkflowManagerComponent } from '@/components/workflow-manager'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { useSession } from '@/app/utils/session/session';
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
  const { getApiHeaders, loading: sessionLoading, initialized } = useSession();

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
    } catch (error) {
      console.error('Error loading workflows:', error);
      setError('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  }, [getApiHeaders]);

  useEffect(() => {
    if (!sessionLoading && initialized) {
      loadWorkflows();
    }
  }, [sessionLoading, initialized, loadWorkflows]);

  const handleDeleteClick = (workflow: Workflow) => {
    setWorkflowToDelete(workflow)
    setShowDeleteConfirmation(true)
  }

  const confirmDelete = async () => {
    if (workflowToDelete && workflowToDelete.id) {
      try {
        const headers = getApiHeaders();
        if (!headers) {
          console.error('No valid headers available');
          return;
        }

        await deleteWorkflow(workflowToDelete.id, headers);
        setWorkflows(workflows.filter(workflow => workflow.id !== workflowToDelete.id));
        setShowDeleteConfirmation(false);
        setWorkflowToDelete(null);
      } catch (error) {
        console.error('Error deleting workflow:', error);
      }
    }
  }

  const filteredWorkflows = workflows.filter(workflow =>
    workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workflow.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleNewWorkflow = () => {
    setSelectedWorkflow(null)
    setShowWorkflowManager(true)
  }

  const handleEditWorkflow = (workflow: Workflow) => {
    setSelectedWorkflow(workflow)
    setShowWorkflowManager(true)
  }

  const handleWorkflowSaved = () => {
    setShowWorkflowManager(false)
    loadWorkflows()
  }

  const toggleChatbot = (modelId: string) => {
    // This function is required by AppSidebar props but won't be used
    // since AppSidebar will handle the routing internally
  }

  if (isLoading) return <div>Loading workflows...</div>
  if (error) return <div>Error: {error}</div>

  if (showWorkflowManager) {
    return (
      <WorkflowManagerComponent
        workflow={selectedWorkflow}
        onSave={handleWorkflowSaved}
        onCancel={() => setShowWorkflowManager(false)}
      />
    )
  }

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="flex items-center justify-between p-4 border-b bg-white">
            <h1 className="text-2xl font-bold">Workflows</h1>
            <Button onClick={handleNewWorkflow} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> New Workflow
            </Button>
          </div>
          <div className="p-4">
            <Input
              type="search"
              placeholder="Search workflows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
          </div>
          <ScrollArea className="flex-grow">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredWorkflows.length > 0 ? (
                filteredWorkflows.map((workflow) => (
                  <Card key={workflow.id} className="flex flex-col">
                    <CardContent className="flex-grow p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">{workflow.name}</h3>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/workflow/${workflow.id}`)} className="text-green-600 hover:text-green-700 hover:bg-green-100">
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditWorkflow(workflow)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-100">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteClick(workflow)} 
                            className="text-red-500 hover:text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm mb-4">{workflow.description}</p>
                    </CardContent>
                    <CardFooter className="border-t p-4">
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                        {workflow.process_type}
                      </Badge>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center text-gray-500">No workflows found</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

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
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
