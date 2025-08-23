'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, Copy, FileText, Check, RefreshCw } from 'lucide-react'
import { 
  fetchWorkflow,
  streamWorkflow,
  createAssetsFromFiles
} from '@/utils/workflow-service'
import { 
  Workflow, 
  WorkflowResult,
  WorkflowStreamMessage 
} from '@/types/workflow'
import { fetchPromptTemplate, PromptTemplate } from '@/utils/prompt-template-service'
import { ComplexPromptModal } from '@/components/complex-prompt-modal'
import { WorkflowDynamicInputModal } from '@/components/workflow-dynamic-input-modal'
import ReactMarkdown from 'react-markdown'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { addToScratchPad } from '@/utils/scratch-pad-service'
import { useSession } from '@/app/utils/session/session'
import { GeneratingButton } from '@/components/batch-flow/generating-button'
import { UploadedFile } from '@/utils/upload-service'
import { dlog, derror } from '@/utils/debug'

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
  const [showDynamicInputModal, setShowDynamicInputModal] = useState(false);
  const [hasSubmittedDynamicInputs, setHasSubmittedDynamicInputs] = useState(false);
  const [dynamicInputData, setDynamicInputData] = useState<{
    file_ids?: string[];
    asset_ids?: string[];
    knowledge_base_ids?: string[];
  } | null>(null);
  
  // Store step information in a ref to avoid re-renders
  const stepInfoRef = useRef<{
    [position: number]: {
      chatModel: { name: string; model: string; id: string };
      persona: { role: string; goal: string; id: string };
    };
  }>({});

  const handleStreamMessage = useCallback((message: WorkflowStreamMessage) => {
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

      // Get step number as a number for lookup
      const stepNumber = typeof message.step === 'string' 
        ? parseInt(message.step, 10) 
        : (message.step as number);
      
      // Get the cached step info
      const stepInfo = stepInfoRef.current[stepNumber];
      
      if (!stepInfo) {
        console.warn(`No cached info found for step ${stepNumber}`);
      } else {
        console.log(`Using cached info for step ${stepNumber}:`, {
          model: stepInfo.chatModel.name,
          persona: stepInfo.persona.role
        });
      }
      
      // Create a new result with the cached information
      const newResult: WorkflowResult = {
        step: message.step!.toString(),
        prompt: promptToShow,
        response: message.response,
        // Use cached data that was prepared before streaming started
        chat_model: stepInfo?.chatModel,
        persona: stepInfo?.persona
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
  }, [submittedPrompt]);

  const executeWorkflowStream = useCallback(async (
    message?: string,
    dynamicInputs?: {
      file_ids?: string[];
      asset_ids?: string[];
      knowledge_base_ids?: string[];
    }
  ) => {
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

    const inputData = {
      message: message || initialMessage,
      ...(dynamicInputs || dynamicInputData || {})
    };

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
      inputData
    );

    cleanupRef.current = cleanup;
    return cleanup;
  }, [params.workflowId, getApiHeaders, handleStreamMessage, initialMessage, dynamicInputData]);

  const checkFirstStep = useCallback(async (workflow: Workflow) => {
    // Check for dynamic inputs first (but only if not already submitted)
    if ((workflow.allow_file_upload || workflow.allow_asset_selection) && !hasSubmittedDynamicInputs) {
      setShowDynamicInputModal(true);
      return;
    }
    
    // Then check for complex prompt (existing logic)
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
    } else {
      executeWorkflowStream();
    }
  }, [getApiHeaders, executeWorkflowStream, hasSubmittedComplexPrompt, hasSubmittedDynamicInputs]);

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
      
      // Cache step information from the API response
      const stepsInfo: {
        [position: number]: {
          chatModel: { name: string; model: string; id: string };
          persona: { role: string; goal: string; id: string };
        };
      } = {};
      
      // Extract and store the chat model and persona information
      if (fetchedWorkflow.steps && Array.isArray(fetchedWorkflow.steps)) {
        fetchedWorkflow.steps.forEach((step: any, index) => {
          if (step.chat_model && step.persona) {
            stepsInfo[index + 1] = {
              chatModel: {
                name: step.chat_model.name,
                model: step.chat_model.model,
                id: step.chat_model.id.toString()
              },
              persona: {
                role: step.persona.role,
                goal: step.persona.goal,
                id: step.persona.id.toString()
              }
            };
            console.log(`Cached step ${index + 1} info:`, {
              model: step.chat_model.name,
              persona: step.persona.role
            });
          } else {
            console.warn(`Step ${index + 1} is missing chat_model or persona information`);
          }
        });
      }
      
      console.log('Cached workflow steps info:', stepsInfo);
      // Store in ref to avoid re-renders
      stepInfoRef.current = stepsInfo;
      
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

  // Reset state when switching between workflows
  useEffect(() => {
    setHasSubmittedDynamicInputs(false);
    setDynamicInputData(null);
    setHasSubmittedComplexPrompt(false);
    setInitialMessage(undefined);
    setSubmittedPrompt(undefined);
    setResults([]);
    setError(null);
  }, [params.workflowId]);

  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    console.log('Complex prompt submitted:', generatedPrompt);
    setShowComplexPromptModal(false);
    setInitialMessage(generatedPrompt);
    setSubmittedPrompt(generatedPrompt);
    setHasSubmittedComplexPrompt(true);
    executeWorkflowStream(generatedPrompt);
  };

  const handleDynamicInputSubmit = async (data: {
    uploadedFiles: UploadedFile[];
    selectedAssets: string[];
    selectedKnowledgeBases: string[];
  }) => {
    try {
      dlog('handleDynamicInputSubmit called with:', data);
      setShowDynamicInputModal(false);
      
      // Create assets from uploaded files if any
      let createdAssetIds: string[] = [];
      if (data.uploadedFiles.length > 0) {
        const headers = getApiHeaders();
        if (headers) {
          dlog('Creating assets from uploaded files...');
          const result = await createAssetsFromFiles(
            params.workflowId,
            data.uploadedFiles.map(f => ({
              id: f.id,
              name: f.name,
              type: f.type,
              size: f.size,
              uploadURL: f.uploadURL
            })),
            headers
          );
          createdAssetIds = result.asset_ids;
          dlog('Created asset IDs:', createdAssetIds);
        }
      }
      
      // Build dynamic inputs sparsely - only include non-empty arrays
      const dynamicInputs: {
        file_ids?: string[];
        asset_ids?: string[];
        knowledge_base_ids?: string[];
      } = {};
      if (createdAssetIds.length) dynamicInputs.file_ids = createdAssetIds;
      if (data.selectedAssets.length) dynamicInputs.asset_ids = data.selectedAssets;
      if (data.selectedKnowledgeBases.length) dynamicInputs.knowledge_base_ids = data.selectedKnowledgeBases;
      
      setDynamicInputData(dynamicInputs);
      setHasSubmittedDynamicInputs(true);
      dlog('Dynamic input data stored:', dynamicInputs);
      
      // Now check if we need to show complex prompt
      if (workflow?.steps.length && workflow.steps.length > 0 && !hasSubmittedComplexPrompt) {
        const firstStep = workflow.steps[0];
        const headers = getApiHeaders();
        if (headers) {
          dlog('Checking for complex prompt...');
          const promptTemplate = await fetchPromptTemplate(firstStep.prompt_template_id, headers);
          if (promptTemplate.is_complex) {
            dlog('Complex prompt found, showing modal');
            setComplexPromptTemplate(promptTemplate);
            setShowComplexPromptModal(true);
            return;
          }
        }
      }
      
      dlog('Executing workflow with dynamic inputs:', dynamicInputs);
      // Execute workflow with dynamic inputs
      executeWorkflowStream(undefined, dynamicInputs);
      
    } catch (error) {
      derror('Error handling dynamic input:', error);
      setError('Failed to process dynamic inputs');
    }
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
    // Clear all previous state for a fresh run
    setHasSubmittedComplexPrompt(false);
    setHasSubmittedDynamicInputs(false);
    setDynamicInputData(null);
    setInitialMessage(undefined);
    setSubmittedPrompt(undefined);
    setResults([]);
    setError(null);
    
    // Reuse the same entry logic as initial load for consistency
    if (workflow) {
      checkFirstStep(workflow);
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
                  {result.chat_model && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      using {result.chat_model.name}
                    </span>
                  )}
                  {result.persona && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      as {result.persona.role}
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
          {workflow && showDynamicInputModal && (
            <WorkflowDynamicInputModal
              workflow={workflow}
              isOpen={showDynamicInputModal}
              onClose={() => setShowDynamicInputModal(false)}
              onSubmit={handleDynamicInputSubmit}
            />
          )}
        </div>
      </main>
    </div>
  );
} 