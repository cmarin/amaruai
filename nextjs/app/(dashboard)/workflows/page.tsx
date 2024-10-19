'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, ChevronLeft, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Workflow, fetchWorkflows, deleteWorkflow } from '@/components/workflowService'
import { Badge } from "@/components/ui/badge"
import { useRouter } from 'next/navigation'
import { WorkflowManagerComponent } from '@/components/workflow-manager'

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showWorkflowManager, setShowWorkflowManager] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadWorkflows()
  }, [])

  const loadWorkflows = async () => {
    try {
      const fetchedWorkflows = await fetchWorkflows()
      setWorkflows(fetchedWorkflows)
    } catch (error) {
      console.error('Error loading workflows:', error)
    }
  }

  const handleDelete = async (id: string | undefined) => {
    if (!id) {
      console.error('Cannot delete workflow: id is undefined');
      return;
    }
    try {
      await deleteWorkflow(id)
      setWorkflows(workflows.filter(workflow => workflow.id !== id))
    } catch (error) {
      console.error('Error deleting workflow:', error)
    }
  }

  const filteredWorkflows = workflows.filter(workflow =>
    workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workflow.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleBack = () => {
    router.push('/chat')
  }

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
    <div className="fixed inset-0 bg-white z-50 flex flex-col h-screen">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <Button variant="ghost" onClick={handleBack} className="mr-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Workflows</h1>
        </div>
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
                        onClick={() => handleDelete(workflow.id)} 
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
  )
}
