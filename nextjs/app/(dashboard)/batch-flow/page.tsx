'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/app/utils/session/session';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { useData } from '@/components/data-context';
import { useSidebar } from '@/components/sidebar-context';
import { AppSidebar } from '@/components/app-sidebar';
import { Dashboard } from '@uppy/react';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { Button } from '@/components/ui/button';
import { getAssetStatus, executeBatchFlow } from '@/utils/batch-flow-service';
import { UploadService } from '@/utils/upload-service';
import type { BatchFlowStep } from '@/types';
import { WorkflowSteps } from '@/components/batch-flow/workflow-steps';
import { FileProcessing } from '@/components/batch-flow/file-processing';
import { ReviewStep } from '@/components/batch-flow/review-step';
import { StreamingResults } from '@/components/batch-flow/streaming-results';
import type { UploadedFile, PromptTemplateOption, ChatModelOption, PersonaOption } from '@/components/batch-flow/types';
import type { UploadedFile as BaseUploadedFile } from '@/utils/upload-service';

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
  const { session } = useSession();
  const supabase = useSupabase();
  const { promptTemplates, chatModels, personas } = useData();
  const { sidebarOpen, toggleSidebar } = useSidebar();

  const [currentStep, setCurrentStep] = useState<StepId>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<BatchFlowStep[]>([{
    prompt_template_id: '',
    chat_model_id: '',
    persona_id: ''
  }]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [fileResponses, setFileResponses] = useState<Record<string, string>>({});
  const [totalTokens, setTotalTokens] = useState(0);

  useEffect(() => {
    const newTotal = uploadedFiles.reduce((sum, file) => 
      sum + (file.status.token_count || 0), 0
    );
    setTotalTokens(newTotal);
  }, [uploadedFiles]);

  const handleFileUpload = useCallback((file: BaseUploadedFile) => {
    const fileWithStatus: UploadedFile = {
      ...file,
      status: {
        id: '',
        status: 'pending',
        token_count: 0,
        file_name: file.name
      }
    };
    setUploadedFiles(prev => [...prev, fileWithStatus]);
  }, []);

  const handleRemoveFile = useCallback((file: UploadedFile) => {
    setUploadedFiles(prev => prev.filter(f => f !== file));
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

  const handleExecute = useCallback(async () => {
    if (!session) return;
    
    setIsProcessing(true);
    setFileResponses({});
    
    try {
      await executeBatchFlow(
        {
          file_ids: uploadedFiles.map(file => file.status.id),
          steps: workflowSteps,
          customInstructions
        },
        session.access_token,
        (message) => {
          if (message.type === 'progress') {
            setProcessingStatus(
              `Processing ${message.fileName} (${message.currentStep}/${message.totalSteps})`
            );
          } else if (message.type === 'error') {
            setProcessingStatus(`Error: ${message.error}`);
          } else if (message.type === 'completion' && message.fileId && message.response) {
            setFileResponses(prev => {
              const newResponses = { ...prev };
              if (message.fileId) {
                newResponses[message.fileId] = message.response || '';
              }
              return newResponses;
            });
            setProcessingStatus('Processing complete!');
          }
        }
      );
    } catch (error: unknown) {
      console.error('Failed to execute batch flow:', error);
      setProcessingStatus('Failed to execute batch flow');
    } finally {
      setIsProcessing(false);
    }
  }, [session, uploadedFiles, workflowSteps, customInstructions]);

  const uppy = React.useMemo(() => {
    if (!session || !supabase) return null;

    return UploadService.createUppy(
      'batch-flow-uploader',
      {
        maxFiles: 10,
        allowedFileTypes: ['video/*', 'image/*', '.pdf', '.doc', '.docx', '.txt']
      },
      handleFileUpload,
      undefined,
      supabase
    );
  }, [session, supabase, handleFileUpload]);

  if (!session || !uppy) {
    return null;
  }

  // Convert data context items to the correct types
  const promptTemplateOptions: PromptTemplateOption[] = promptTemplates.map(t => ({
    id: String(t.id),
    title: t.title
  }));

  const chatModelOptions: ChatModelOption[] = chatModels.map(m => ({
    id: String(m.id),
    name: m.name
  }));

  const personaOptions: PersonaOption[] = personas.map(p => ({
    id: String(p.id),
    role: p.role
  }));

  return (
    <div className="flex h-screen bg-gray-100">
      <AppSidebar toggleChatbot={(modelId: string) => {}} />
      
      <div className={`flex-1 p-8 ${sidebarOpen ? 'ml-64' : ''}`}>
        <div className="max-w-4xl mx-auto">
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

          <div className="bg-white p-6 rounded-lg shadow">
            {currentStep === 'upload' && (
              <div>
                <Dashboard
                  uppy={uppy}
                  proudlyDisplayPoweredByUppy={false}
                  showProgressDetails
                  height={400}
                  showRemoveButtonAfterComplete={true}
                  hideUploadButton={true}
                  hideRetryButton={true}
                  hideCancelButton={false}
                  doneButtonHandler={null}
                />

                <div className="flex justify-between mt-4">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={true}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleNext}
                    disabled={uploadedFiles.length === 0}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'process' && (
              <FileProcessing
                totalTokens={totalTokens}
                maxTokens={MAX_TOKENS}
                uploadedFiles={uploadedFiles}
                onRemoveFile={handleRemoveFile}
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
                onExecute={() => {
                  handleExecute();
                  setCurrentStep('results');
                }}
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
                  setCurrentStep('upload');
                }}
                session={session}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
