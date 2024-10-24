'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, Copy, FileText, Check } from 'lucide-react'
import { fetchWorkflow, Workflow, executeWorkflow, getWorkflowResults, WorkflowResult } from '@/components/workflowService'
import { fetchPromptTemplate, PromptTemplate } from '@/components/promptTemplateService'
import { ComplexPromptModal } from '@/components/complex-prompt-modal'
import ReactMarkdown from 'react-markdown'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/SidebarContext'
import { addToScratchPad } from '@/components/scratchPadService'

const MAX_EMPTY_POLLS = 5;

export default function WorkflowExecutionPage({ params }: { params: { workflowId: string } }) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [results, setResults] = useState<WorkflowResult[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showComplexPromptModal, setShowComplexPromptModal] = useState(false)
  const [complexPromptTemplate, setComplexPromptTemplate] = useState<PromptTemplate | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const emptyPollCount = useRef(0)
  const hasReceivedResults = useRef(false)
  const isPolling = useRef(false)
  const { sidebarOpen } = useSidebar()

  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        const fetchedWorkflow = await fetchWorkflow(params.workflowId)
        setWorkflow(fetchedWorkflow)
        await checkFirstStep(fetchedWorkflow)
      } catch (error) {
        console.error('Error loading workflow:', error)
        setError('Failed to load workflow')
      }
    }
    loadWorkflow()

    // Cleanup function to ensure polling stops when component unmounts
    return () => {
      isPolling.current = false;
    }
  }, [params.workflowId])

  const checkFirstStep = async (workflow: Workflow) => {
    if (workflow.steps.length > 0) {
      const firstStep = workflow.steps[0]
      try {
        const promptTemplate = await fetchPromptTemplate(parseInt(firstStep.prompt_template_id))
        
        if (promptTemplate.is_complex) {
          setComplexPromptTemplate(promptTemplate)
          setShowComplexPromptModal(true)
        } else {
          executeWorkflowAndPollResults()
        }
      } catch (error) {
        console.error('Error fetching prompt template:', error)
        setError('Failed to fetch prompt template')
      }
    } else {
      setError('Workflow has no steps')
    }
  }

  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    console.log('Complex prompt submitted:', generatedPrompt);
    setShowComplexPromptModal(false);
    executeWorkflowAndPollResults(generatedPrompt);
  };

  const executeWorkflowAndPollResults = async (message?: string) => {
    if (isExecuting) {
      console.log('Workflow is already executing. Ignoring this call.');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResults([]);  // Clear previous results
    emptyPollCount.current = 0;
    hasReceivedResults.current = false;

    try {
      if (message) {
        console.log('Executing workflow with message:', message);
        const trimmedMessage = message.trim();
        await executeWorkflow(params.workflowId, 'user', `workflow_execution_${Date.now()}`, trimmedMessage);
      } else {
        console.log('Executing workflow without message');
        await executeWorkflow(params.workflowId, 'user', `workflow_execution_${Date.now()}`);
      }
      pollResults();
    } catch (error) {
      console.error('Error executing workflow:', error);
      setError(`Failed to execute workflow: ${error}`);
      setIsExecuting(false);
    }
  };

  const pollResults = async () => {
    if (isPolling.current) {
      console.log('Already polling. Ignoring this call.');
      return;
    }

    isPolling.current = true;
    console.log('Starting to poll for results');

    const pollInterval = setInterval(async () => {
      if (!isPolling.current) {
        console.log('Polling stopped. Clearing interval.');
        clearInterval(pollInterval);
        return;
      }

      try {
        const fetchedResults = await getWorkflowResults(params.workflowId);
        console.log('Fetched results:', fetchedResults);

        if (fetchedResults.length > 0) {
          hasReceivedResults.current = true;
          emptyPollCount.current = 0;

          // Check for completion message
          const completionMessage = fetchedResults.find(result => 'completed' in result);
          if (completionMessage) {
            console.log('Received completion message. Workflow execution is complete.');
            setResults(prevResults => [...prevResults, ...fetchedResults.filter(result => !('completed' in result))]);
            clearInterval(pollInterval);
            setIsExecuting(false);
            isPolling.current = false;
            return;
          }

          setResults(prevResults => {
            const newResults = [...prevResults];
            fetchedResults.forEach(result => {
              if (!newResults.some(r => r.step === result.step)) {
                newResults.push(result);
              }
            });
            return newResults;
          });
        } else if (hasReceivedResults.current) {
          emptyPollCount.current += 1;
          console.log('Empty poll count:', emptyPollCount.current);
        }

        if (emptyPollCount.current >= MAX_EMPTY_POLLS) {
          console.log('Reached maximum number of empty polls. Stopping.');
          clearInterval(pollInterval);
          setIsExecuting(false);
          isPolling.current = false;
        }
      } catch (error) {
        console.error('Error fetching results:', error);
        setError(`Failed to fetch workflow results: ${error}`);
        clearInterval(pollInterval);
        setIsExecuting(false);
        isPolling.current = false;
      }
    }, 2000);  // Poll every 2 seconds

    // Ensure the interval is cleared if the component unmounts
    return () => {
      clearInterval(pollInterval);
      isPolling.current = false;
    };
  };

  const toggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  }

  const handleCopyToClipboard = () => {
    const content = results.map(result => `Step ${result.step}:\nPrompt: ${result.prompt}\nResponse: ${result.response}`).join('\n\n');
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const handleAddToScratchPad = () => {
    const content = `Workflow: ${workflow?.name}\n\n` + results.map(result => `Step ${result.step}:\nPrompt: ${result.prompt}\nResponse: ${result.response}`).join('\n\n');
    addToScratchPad(content);
    // You might want to add some visual feedback here, like a temporary message
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-56' : 'ml-14'}`}>
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center">
              <Button variant="ghost" onClick={() => router.push('/workflows')} className="mr-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Workflows
              </Button>
              <h1 className="text-2xl font-bold">{workflow?.name || 'Loading...'}</h1>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddToScratchPad}
                className="flex items-center"
              >
                <FileText className="mr-2 h-4 w-4" />
                Add to Scratch Pad
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyToClipboard}
                className="flex items-center"
              >
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </Button>
            </div>
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
          {showComplexPromptModal && complexPromptTemplate && (
            <ComplexPromptModal
              prompt={complexPromptTemplate}
              isOpen={showComplexPromptModal}
              onClose={() => setShowComplexPromptModal(false)}
              onSubmit={handleComplexPromptSubmit}
            />
          )}
        </div>
      </div>
    </div>
  )
}
