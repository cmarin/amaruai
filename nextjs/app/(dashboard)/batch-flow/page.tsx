'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useSession } from '@/app/utils/session/session';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { useData } from '@/components/data-context';
import { useSidebar } from '@/components/sidebar-context';
import type { KnowledgeBase } from '@/utils/knowledge-base-service';
import { fetchKnowledgeBases } from '@/utils/knowledge-base-service';
import type { Asset } from '@/types/knowledge-base';
import { AppSidebar } from '@/components/app-sidebar';
import { Dashboard } from '@uppy/react';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { Button } from '@/components/ui/button';
import { getAssetStatus, executeBatchFlow } from '@/utils/batch-flow-service';
import { UploadService } from '@/utils/upload-service';
import type { BatchFlowStep, BatchFlowFile, PromptTemplateOption, ChatModelOption, PersonaOption } from '@/types';
import type { UploadedFile } from '@/utils/upload-service';
import { WorkflowSteps } from '@/components/batch-flow/workflow-steps';
import { FileProcessing } from '@/components/batch-flow/file-processing';
import { ReviewStep } from '@/components/batch-flow/review-step';
import { StreamingResults } from '@/components/batch-flow/streaming-results';
import { UploadStep } from '@/components/batch-flow/upload-step';

const MAX_TOKENS = 100_000;

const steps = [
  { id: 'upload', label: 'Upload' },
  { id: 'process', label: 'Process' },
  { id: 'configure', label: 'Configure' },
  { id: 'review', label: 'Review' },
  { id: 'results', label: 'Results' },
] as const;

type StepId = typeof steps[number]['id'];

export default function BatchFlow() {
  const { session, getApiHeaders } = useSession();
  const supabase = useSupabase();
  const { promptTemplates, chatModels, personas, isLoading } = useData();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(false);
  const { sidebarOpen, toggleSidebar } = useSidebar();

  const [currentStep, setCurrentStep] = useState<StepId>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<BatchFlowFile[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<BatchFlowStep[]>([{
    prompt_template_id: '',
    chat_model_id: '',
    persona_id: ''
  }]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [totalTokens, setTotalTokens] = useState(0);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const contentRef = useRef('');

  useEffect(() => {
    const loadKnowledgeBases = async () => {
      if (!session) return;
      
      setIsLoadingKnowledgeBases(true);
      try {
        const headers = await getApiHeaders();
        if (headers) {
          const fetchedKnowledgeBases = await fetchKnowledgeBases(headers);
          setKnowledgeBases(fetchedKnowledgeBases);
        }
      } catch (error) {
        console.error('Error fetching knowledge bases:', error);
      } finally {
        setIsLoadingKnowledgeBases(false);
      }
    };

    loadKnowledgeBases();
  }, [session, getApiHeaders]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);

  const handleFileUpload = useCallback((file: UploadedFile) => {
    const fileWithStatus: BatchFlowFile = {
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadURL: file.uploadURL,
      file_name: file.name,
      status: {
        id: '',
        status: 'pending',
        token_count: 0,
        file_name: file.name
      }
    };
    setUploadedFiles(prev => [...prev, fileWithStatus]);
  }, []);

  const handleRemoveFile = useCallback((file: BatchFlowFile) => {
    setUploadedFiles(prev => prev.filter(f => f !== file));
  }, []);

  const handleRemoveKnowledgeBase = useCallback((kb: KnowledgeBase) => {
    setSelectedKnowledgeBases(prev => prev.filter(k => k.id !== kb.id));
  }, []);

  const handleRemoveAsset = useCallback((asset: Asset) => {
    setSelectedAssets(prev => prev.filter(a => a.id !== asset.id));
  }, []);

  const handleUpdateStep = useCallback((index: number, field: keyof BatchFlowStep, value: string) => {
    setWorkflowSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = { ...newSteps[index], [field]: value };
      return newSteps;
    });
  }, []);

  const handleRemoveStep = useCallback((index: number) => {
    setWorkflowSteps(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddStep = useCallback(() => {
    setWorkflowSteps(prev => [...prev, {
      prompt_template_id: '',
      chat_model_id: '',
      persona_id: ''
    }]);
  }, []);

  const handleNext = useCallback(() => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id as StepId);
    }
  }, [currentStep]);

  const handlePrevious = useCallback(() => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as StepId);
    }
  }, [currentStep]);

  const [shouldExecute, setShouldExecute] = useState(false);

  useEffect(() => {
    if (shouldExecute && currentStep === 'results' && session) {
      const execute = async () => {
        setIsProcessing(true);
        setStreamingContent('');
        contentRef.current = '';
        
        try {
          await executeBatchFlow(
            {
              file_ids: [
                ...uploadedFiles.map(file => file.status.id),
                ...selectedKnowledgeBases.map(kb => kb.id),
                ...selectedAssets.map(asset => asset.id)
              ],
              steps: workflowSteps,
              customInstructions
            },
            session.access_token,
            (message) => {
              if (typeof message === 'string') {
                try {
                  const parsed = JSON.parse(message);
                  if (parsed.choices?.[0]?.delta?.content) {
                    contentRef.current += parsed.choices[0].delta.content;
                    setStreamingContent(contentRef.current);
                  }
                } catch (err) {
                  console.error('Error parsing message:', err);
                }
              } else if (message.type === 'progress') {
                setProcessingStatus(
                  `Processing ${message.fileName} (${message.currentStep}/${message.totalSteps})`
                );
              } else if (message.type === 'error') {
                setProcessingStatus(`Error: ${message.error}`);
              } else if (message.type === 'completion') {
                setProcessingStatus('Processing complete!');
              }
            }
          );
        } catch (error: unknown) {
          console.error('Failed to execute batch flow:', error);
          setProcessingStatus('Failed to execute batch flow');
        } finally {
          setIsProcessing(false);
          setShouldExecute(false);
        }
      };

      execute();
    }
  }, [shouldExecute, currentStep, session, uploadedFiles, selectedKnowledgeBases, selectedAssets, workflowSteps, customInstructions]);

  const handleExecute = useCallback(() => {
    setCurrentStep('results');
    setShouldExecute(true);
  }, [session, uploadedFiles, selectedKnowledgeBases, selectedAssets, workflowSteps, customInstructions, setCurrentStep]);

  const uppyRef = useMemo(() => {
    if (!session || !supabase) return null;

    return UploadService.createUppy(
      'batch-uploader',
      {
        maxFiles: 10,
        storageFolder: 'batch-flow',
        restrictions: {
          allowedFileTypes: ['video/*', 'image/*', '.pdf', '.doc', '.docx', '.txt']
        }
      },
      handleFileUpload,
      undefined,
      supabase
    );
  }, [session, supabase, handleFileUpload]);

  useEffect(() => {
    const newTotal = uploadedFiles.reduce((sum, file) => 
      sum + (file.status.token_count || 0), 0
    );
    setTotalTokens(newTotal);
  }, [uploadedFiles]);

  useEffect(() => {
    if (!session || uploadedFiles.length === 0 || currentStep !== 'process') {
      return;
    }

    const pollInterval = setInterval(async () => {
      const updatedFiles = await Promise.all(
        uploadedFiles.map(async (file) => {
          if (!file.uploadURL) return file;
          try {
            const status = await getAssetStatus(file.uploadURL, session.access_token);
            return {
              ...file,
              status
            };
          } catch (error) {
            console.error('Error getting asset status:', error);
            return file;
          }
        })
      );

      // Check if any files were actually updated
      const hasChanges = updatedFiles.some((newFile, index) => {
        const oldFile = uploadedFiles[index];
        return (
          newFile.status.status !== oldFile.status.status ||
          newFile.status.token_count !== oldFile.status.token_count
        );
      });

      if (hasChanges) {
        setUploadedFiles(updatedFiles);
      }

      // Stop polling if all files are processed
      if (updatedFiles.every(
        file => ['completed', 'failed', 'max_attempts_exceeded'].includes(file.status.status)
      )) {
        clearInterval(pollInterval);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [session, uploadedFiles, currentStep]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session || !uppyRef) {
    return null;
  }

  // Convert data context items to the correct types
  const promptTemplateOptions: PromptTemplateOption[] = promptTemplates.map(t => ({
    id: String(t.id),
    title: t.title,
    prompt: t.prompt,
    // Include the full prompt template for preview
    _template: t
  }));

  const chatModelOptions: ChatModelOption[] = chatModels.map(m => ({
    id: String(m.id),
    name: m.name,
    description: m.description || '',
    // Include the full chat model for preview
    _model: m
  }));

  const personaOptions: PersonaOption[] = personas.map(p => ({
    id: String(p.id),
    role: p.role
  }));

  return (
    <div className="flex h-screen bg-white">
      <AppSidebar toggleChatbot={(modelId: string) => {}} />
      
      <div className={`flex-1 p-8 bg-white ${sidebarOpen ? 'ml-64' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-8">Batch Flow</h1>

          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step.id === currentStep
                      ? 'bg-blue-500 text-white'
                      : 'border-2 border-blue-500 text-blue-500'
                  }`}
                >
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className="flex-1 h-0.5 bg-blue-500 mx-2" />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="p-6 border rounded-lg">
            {currentStep === 'upload' && (
              <UploadStep
                uppyRef={uppyRef}
                uploadedFiles={uploadedFiles}
                knowledgeBases={knowledgeBases}
                isLoadingKnowledgeBases={isLoadingKnowledgeBases}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onKnowledgeBasesChange={setSelectedKnowledgeBases}
                onAssetsChange={setSelectedAssets}
              />
            )}

            {currentStep === 'process' && (
              <FileProcessing
                totalTokens={totalTokens}
                maxTokens={MAX_TOKENS}
                uploadedFiles={uploadedFiles}
                selectedKnowledgeBases={selectedKnowledgeBases}
                selectedAssets={selectedAssets}
                onRemoveFile={handleRemoveFile}
                onRemoveKnowledgeBase={handleRemoveKnowledgeBase}
                onRemoveAsset={handleRemoveAsset}
                onPrevious={handlePrevious}
                onNext={handleNext}
              />
            )}

            {currentStep === 'configure' && (
              <>
                <WorkflowSteps
                  steps={workflowSteps}
                  onUpdateStep={handleUpdateStep}
                  onRemoveStep={handleRemoveStep}
                  onAddStep={handleAddStep}
                  promptTemplates={promptTemplateOptions}
                  chatModels={chatModelOptions}
                  personas={personaOptions}
                />

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={handlePrevious}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleNext}
                    disabled={!workflowSteps.some(step => 
                      step.prompt_template_id && step.chat_model_id && step.persona_id
                    )}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}

            {currentStep === 'review' && (
              <ReviewStep
                customInstructions={customInstructions}
                onInstructionsChange={setCustomInstructions}
                onPrevious={handlePrevious}
                onExecute={handleExecute}
              />
            )}

            {currentStep === 'results' && (
              <StreamingResults
                isProcessing={isProcessing}
                processingStatus={processingStatus}
                uploadedFiles={uploadedFiles}
                steps={workflowSteps}
                customInstructions={customInstructions}
                onPrevious={handlePrevious}
                onStartNewBatch={() => {
                  setUploadedFiles([]);
                  setSelectedKnowledgeBases([]);
                  setSelectedAssets([]);
                  setCurrentStep('upload');
                }}
                session={session}
                streamingContent={streamingContent}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
