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
} from '@/utils/workflow-service'
import { fetchChatModel, ChatModel } from '@/utils/chat-model-service'
import { fetchPersona, Persona } from '@/utils/persona-service'
import { fetchPromptTemplate, PromptTemplate } from '@/utils/prompt-template-service'
import { ComplexPromptModal } from '@/components/complex-prompt-modal'
import ReactMarkdown from 'react-markdown'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { addToScratchPad } from '@/utils/scratch-pad-service'
import { useSession } from '@/app/utils/session/session'
import { GeneratingButton } from '@/components/batch-flow/generating-button'

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
  const [submittedPrompt, setSubmittedPrompt] = useState<string | undefined>(undefined);

  const handleStreamMessage = useCallback(async (message: WorkflowStreamMessage) => {
    if (message.type === 'error') {
      setError(message.error || 'Unknown error occurred');
      setIsExecuting(false);
      setShowRunAgain(true);
      return;
    }

    if (message.type === 'step' && message.prompt && message.response) {
      const promptToShow = message.step === 1 && submittedPrompt 
        ? submittedPrompt 
        : message.prompt;

      // Log the incoming message data in detail
      console.log('Received step message with data:', {
        step: message.step,
        chat_model: message.chat_model ? {
          id: message.chat_model.id,
          name: message.chat_model.name,
          model: message.chat_model.model
        } : 'undefined',
        persona: message.persona ? {
          id: message.persona.id,
          role: message.persona.role,
          goal: message.persona.goal
        } : 'undefined'
      });

      let chatModel = message.chat_model;
      let persona = message.persona;

      // If we have a workflow and step number, try to get complete model and persona data
      if (workflow && typeof message.step === 'number') {
        const stepIndex = message.step - 1;
        if (workflow.steps && workflow.steps[stepIndex]) {
          const step = workflow.steps[stepIndex];
          
          // If we don't have chat_model data but have the step, try to get it
          if ((!chatModel || chatModel.name.startsWith('Model ')) && step.chat_model_id) {
            try {
              const headers = getApiHeaders();
              if (headers) {
                const modelData = await fetchChatModel(step.chat_model_id, headers);
                if (modelData) {
                  chatModel = {
                    id: typeof modelData.id === 'string' ? parseInt(modelData.id) : modelData.id,
                    name: modelData.name || 'Unknown Model',
                    model: modelData.model || ''
                  };
                  console.log('Fetched complete chat model data:', chatModel);
                }
              }
            } catch (err) {
              console.error('Error fetching chat model data:', err);
            }
          }
          
          // If we don't have persona data but have the step, try to get it
          if ((!persona || persona.role.startsWith('Persona ')) && step.persona_id) {
            try {
              const headers = getApiHeaders();
              if (headers) {
                const personaData = await fetchPersona(step.persona_id, headers);
                if (personaData) {
                  persona = {
                    id: typeof personaData.id === 'string' ? parseInt(personaData.id) : personaData.id,
                    role: personaData.role || 'Unknown Persona',
                    goal: personaData.goal || ''
                  };
                  console.log('Fetched complete persona data:', persona);
                }
              }
            } catch (err) {
              console.error('Error fetching persona data:', err);
            }
          }
        }
      }

      const newResult: WorkflowResult = {
        step: message.step!.toString(),
        prompt: promptToShow,
        response: message.response,
        chat_model: chatModel,
        persona: persona
      };

      console.log('Creating new result with chat_model and persona:', {
        chat_model: chatModel,
        persona: persona,
        newResult
      });

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
  }, [submittedPrompt, workflow, getApiHeaders]);

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
      message || initialMessage,
      workflow || undefined
    );

    cleanupRef.current = cleanup;
    return cleanup;
  }, [params.workflowId, getApiHeaders, handleStreamMessage, initialMessage, workflow]);

  const checkFirstStep = useCallback(async (workflow: Workflow) => {
    if (workflow.steps.length > 0 && !hasSubmittedComplexPrompt) {
      const firstStep = workflow.steps[0];
      try {
        const headers = getApiHeaders();
        if (!headers) return;

        console.log('Fetching prompt template...');
        const promptTemplate = await fetchPromptTemplate(firstStep.prompt_template_id, headers);
        
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
    setSubmittedPrompt(generatedPrompt);
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
    <div className="flex min-h-screen w-full">
      <AppSidebar toggleChatbot={toggleChatbot} />
      <main className={`flex-1 min-h-screen transition-all duration-300 ${sidebarOpen ? 'ml-56' : 'ml-14'}`}>
        {isExecuting && <GeneratingButton isGenerating={isExecuting} />}
        <div className="h-full w-full p-6">
          <div className="flex items-center justify-between mb-6 p-4 border-b">
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
            className="flex-grow p-6 mt-4 overflow-auto"
          >
            {error && (
              <div className="text-red-500 dark:text-red-400 mb-6 p-4 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="font-medium">Error:</p>
                <p>{error}</p>
              </div>
            )}
            {isExecuting && (
              <div className="text-blue-600 dark:text-blue-400 mb-6 p-4 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="font-medium">Executing workflow...</p>
                <p>({results.length} steps completed)</p>
              </div>
            )}
            {results.map((result) => (
              <div 
                key={`result-${result.step}`}
                className="mb-8 p-6 border rounded-lg shadow-sm dark:bg-background dark:border-gray-700"
              >
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  Step {result.step}
                  {result.chat_model && result.persona && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                      <span className="font-medium">{result.chat_model.name}</span> as <span className="font-medium">{result.persona.role}</span>
                    </span>
                  )}
                  {result.chat_model && !result.persona && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                      <span className="font-medium">{result.chat_model.name}</span>
                    </span>
                  )}
                  {!result.chat_model && result.persona && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                      <span className="font-medium">{result.persona.role}</span>
                    </span>
                  )}
                </h3>
                <div className="mb-4">
                  <strong className="block mb-2">Prompt:</strong>
                  <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <ReactMarkdown>{result.prompt}</ReactMarkdown>
                  </div>
                </div>
                <div>
                  <strong className="block mb-2">Response:</strong>
                  <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <ReactMarkdown>{result.response}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {showRunAgain && (
              <div className="mt-8 mb-4 flex justify-center">
                <Button
                  onClick={handleRunAgain}
                  className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
                  disabled={isExecuting}
                  size="lg"
                >
                  <RefreshCw className="mr-2 h-5 w-5" />
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
      </main>
    </div>
  );
} 