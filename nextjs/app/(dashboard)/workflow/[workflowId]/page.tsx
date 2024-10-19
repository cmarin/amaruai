'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft } from 'lucide-react'
import { fetchWorkflow, Workflow, executeWorkflow, getWorkflowResults, WorkflowResult } from '@/components/workflowService'
import ReactMarkdown from 'react-markdown'

export default function WorkflowExecutionPage({ params }: { params: { workflowId: string } }) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [results, setResults] = useState<WorkflowResult[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        const fetchedWorkflow = await fetchWorkflow(params.workflowId)
        setWorkflow(fetchedWorkflow)
        executeWorkflowAndPollResults()
      } catch (error) {
        console.error('Error loading workflow:', error)
        setError('Failed to load workflow')
      }
    }
    loadWorkflow()
  }, [params.workflowId])

  const executeWorkflowAndPollResults = async () => {
    setIsExecuting(true)
    setError(null)
    try {
      await executeWorkflow(params.workflowId, 'user', `workflow_execution_${Date.now()}`, 'Execute workflow')
      pollResults()
    } catch (error) {
      console.error('Error executing workflow:', error)
      setError('Failed to execute workflow')
      setIsExecuting(false)
    }
  }

  const pollResults = async () => {
    const pollInterval = setInterval(async () => {
      try {
        const fetchedResults = await getWorkflowResults(params.workflowId)
        setResults(fetchedResults)
        if (fetchedResults.length > 0 && (fetchedResults[fetchedResults.length - 1].step === "Error" || fetchedResults.length === workflow?.steps.length)) {
          clearInterval(pollInterval)
          setIsExecuting(false)
        }
      } catch (error) {
        console.error('Error fetching results:', error)
        setError('Failed to fetch workflow results')
        clearInterval(pollInterval)
        setIsExecuting(false)
      }
    }, 2000)  // Poll every 2 seconds
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col h-screen">
      <div className="flex items-center p-4 border-b">
        <Button variant="ghost" onClick={() => router.push('/workflows')} className="mr-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Workflows
        </Button>
        <h1 className="text-2xl font-bold">{workflow?.name || 'Loading...'}</h1>
      </div>
      <ScrollArea className="flex-grow p-4">
        {error && (
          <div className="text-red-500 mb-4">{error}</div>
        )}
        {isExecuting && (
          <div className="text-blue-500 mb-4">Executing workflow...</div>
        )}
        {results.map((result, index) => (
          <div key={index} className="mb-6 p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Step {result.step}</h3>
            <div className="mb-2">
              <strong>Prompt:</strong>
              <ReactMarkdown>{result.prompt}</ReactMarkdown>
            </div>
            <div>
              <strong>Response:</strong>
              <ReactMarkdown>{result.response}</ReactMarkdown>
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  )
}
