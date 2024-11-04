'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, Copy, FileText, Check, RefreshCw } from 'lucide-react'
import { 
  fetchWorkflow, 
  Workflow, 
  WorkflowResult,
  streamWorkflow,
  WorkflowStreamMessage 
} from '@/components/workflowService'
import { fetchPromptTemplate, PromptTemplate } from '@/components/promptTemplateService'
import { ComplexPromptModal } from '@/components/complex-prompt-modal'
import ReactMarkdown from 'react-markdown'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/SidebarContext'
import { addToScratchPad } from '@/components/scratchPadService'
import { useSession } from '@/app/utils/session/session'

export default function WorkflowStreamPage({ params }: { params: { workflowId: string } }) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [results, setResults] = useState<WorkflowResult[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComplexPromptModal, setShowComplexPromptModal] = useState(false);
  const [complexPromptTemplate, setComplexPromptTemplate] = useState<PromptTemplate | null>(null);
  const [showRunAgain, setShowRunAgain] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const { getApiHeaders } = useSession();
  const { sidebarOpen } = useSidebar();
  const router = useRouter();
  const cleanupRef = useRef<(() => void) | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const [hasSubmittedComplexPrompt, setHasSubmittedComplexPrompt] = useState(false);

  const handleStreamMessage = useCallback((message: WorkflowStreamMessage) => {
    if (message.type === 'error') {
      setError(message.error || 'Unknown error occurred');
      setIsExecuting(false);
      setShowRunAgain(true);
      return;
    }

    if (message.type === 'step' && message.prompt && message.response) {
      let formattedPrompt: string = message.prompt;
      
      // Try to parse the prompt if it's a JSON string
      try {
        const promptObj = JSON.parse(message.prompt);
        if (promptObj.variables && promptObj.prompt) {
          // This is a complex prompt template
          formattedPrompt = promptObj.prompt;
          
          // Get all variables from the template
          const variables = promptObj.variables;
          
          // Replace each variable with its value
          variables.forEach((variable: { fieldName: string }) => {
            if (variable.fieldName) {
              const placeholder = `{${variable.fieldName}}`;
              if (formattedPrompt.includes(placeholder)) {
                // If this is the first variable and we have an initial message, use it
                if (variables.indexOf(variable) === 0 && initialMessage) {
                  formattedPrompt = formattedPrompt.replace(placeholder, initialMessage);
                }
              }
            }
          });
        }
      } catch (e) {
        // If parsing fails, use the prompt as-is
        console.log('Not a JSON prompt, using as-is');
      }

      const newResult: WorkflowResult = {
        step: message.step!.toString(),
        prompt: formattedPrompt,
        response: message.response,
        chat_model: message.chat_model,
        persona: message.persona
      };

      setResults(prev => {
        if (prev.some(r => r.step === newResult.step)) {
          return prev;
        }
        return [...prev, newResult];
      });

      setTimeout(() => {
        if (resultsContainerRef.current) {
          resultsContainerRef.current.scrollTop = resultsContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [initialMessage]);

  const executeWorkflowStream = useCallback(async (message?: string) => {
    if (cleanupRef.current) {
      console.log('Cleaning up previous EventSource before starting new one');
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const headers = getApiHeaders();
    if (!headers) return;

    setIsExecuting(true);
    setResults([]);
    setError(null);
    setShowRunAgain(false);

    const cleanup = streamWorkflow(
      params.workflowId,
      'user',
      `workflow_stream_${Date.now()}`,
      headers,
      handleStreamMessage,
      (error) => {
        setError(error.message);
        setIsExecuting(false);
        setShowRunAgain(true);
        cleanupRef.current = null;
      },
      () => {
        setIsExecuting(false);
        setShowRunAgain(true);
        cleanupRef.current = null;
      },
      message || initialMessage
    );

    cleanupRef.current = cleanup;
    return cleanup;
  }, [params.workflowId, getApiHeaders, handleStreamMessage, initialMessage]);

  const checkFirstStep = useCallback(async (workflow: Workflow) => {
    if (workflow.steps.length > 0 && !hasSubmittedComplexPrompt) {
      const firstStep = workflow.steps[0];
      try {
        const headers = getApiHeaders();
        if (!headers) return;
        
        console.log('Fetching prompt template...');
        const promptTemplate = await fetchPromptTemplate(
          parseInt(firstStep.prompt_template_id),
          headers
        );
        
        if (promptTemplate.is_complex) {
          console.log('First step has complex prompt template:', promptTemplate);
          setComplexPromptTemplate(promptTemplate);
          setShowComplexPromptModal(true);
        } else {
          console.log('First step has simple prompt template, executing workflow...');
          executeWorkflowStream();
        }
      } catch (error) {
        console.error('Error fetching prompt template:', error);
        setError('Failed to fetch prompt template');
      }
    }
  }, [getApiHeaders, executeWorkflowStream, hasSubmittedComplexPrompt]);

  const loadWorkflow = useCallback(async () => {
    const headers = getApiHeaders();
    if (!headers) {
      console.error('No valid headers available');
      return;
    }
    
    try {
      console.log('Fetching workflow...');
      const fetchedWorkflow = await fetchWorkflow(params.workflowId, headers);
      console.log('Fetched workflow:', fetchedWorkflow);
      setWorkflow(fetchedWorkflow);
      await checkFirstStep(fetchedWorkflow);
    } catch (error) {
      console.error('Error loading workflow:', error);
      setError('Failed to load workflow');
    }
  }, [params.workflowId, getApiHeaders, checkFirstStep]);

  useEffect(() => {
    console.log('Component mounted, loading workflow...');
    loadWorkflow();

    return () => {
      if (cleanupRef.current) {
        console.log('Cleaning up previous EventSource');
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [loadWorkflow]);

  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    console.log('Complex prompt submitted:', generatedPrompt);
    setShowComplexPromptModal(false);
    setInitialMessage(generatedPrompt);
    setHasSubmittedComplexPrompt(true);
    executeWorkflowStream(generatedPrompt);
  };

  const toggleChatbot = useCallback((modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  }, [router]);

  const handleCopyToClipboard = useCallback(() => {
    const content = results.map(result => 
      `Step ${result.step}:\nPrompt: ${result.prompt}\nResponse: ${result.response}`
    ).join('\n\n');
    
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }, [results]);

  const handleAddToScratchPad = () => {
    const content = `Workflow: ${workflow?.name}\n\n` + results.map(result => 
      `Step ${result.step}:\nPrompt: ${result.prompt}\nResponse: ${result.response}`
    ).join('\n\n');
    addToScratchPad(content);
  };

  const handleRunAgain = () => {
    setHasSubmittedComplexPrompt(false);
    if (complexPromptTemplate && !hasSubmittedComplexPrompt) {
      setShowComplexPromptModal(true);
    } else {
      executeWorkflowStream();
    }
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-56' : 'ml-14'}`}>
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-2xl font-bold">{workflow?.name || 'Loading...'}</h1>
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
          <div 
            ref={resultsContainerRef}
            className="flex-grow p-4 overflow-auto"
          >
            {error && (
              <div className="text-red-500 mb-4">{error}</div>
            )}
            {isExecuting && (
              <div className="text-blue-500 mb-4">
                Executing workflow... ({results.length} steps completed)
              </div>
            )}
            {results.map((result) => (
              <div 
                key={`result-${result.step}`}
                className="mb-6 p-4 border rounded-lg"
              >
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  Step {result.step}
                  {result.chat_model && (
                    <span className="text-sm text-gray-500">
                      using {result.chat_model.name}
                    </span>
                  )}
                  {result.persona && (
                    <span className="text-sm text-gray-500">
                      as {result.persona.role}
                    </span>
                  )}
                </h3>
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
            {showRunAgain && (
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={handleRunAgain}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isExecuting}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Run Again
                </Button>
              </div>
            )}
          </div>
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
  );
} 