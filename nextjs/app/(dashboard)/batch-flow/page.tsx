'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '@/app/utils/session/session';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { useData } from '@/components/data-context';
import { useSidebar } from '@/components/sidebar-context';
import { AppSidebar } from '@/components/app-sidebar';
import Uppy from '@uppy/core';
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
import { KnowledgeBaseSelector } from '@/components/knowledge-base-selector';
import type { KnowledgeBase, Asset } from '@/types/knowledge-base';
import type { Uppy as UppyType } from '@uppy/core';

const MAX_TOKENS = 100_000;

const steps = [
  { id: 'upload', label: 'Upload Files (Optional)' },
  { id: 'select-sources', label: 'Select Sources' },
  { id: 'process', label: 'Process' },
  { id: 'configure', label: 'Configure' },
  { id: 'review', label: 'Review' },
  { id: 'results', label: 'Results' },
] as const;

type StepId = typeof steps[number]['id'];

export default function BatchFlow() {
  const { session } = useSession();
  const supabase = useSupabase();
  const { promptTemplates, chatModels, personas, knowledgeBases, isLoading } = useData();
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
  const [fileResponses, setFileResponses] = useState<Record<string, string>>({});
  const [totalTokens, setTotalTokens] = useState(0);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [uppyInstance, setUppyInstance] = useState<UppyType | null>(null);

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

  useEffect(() => {
    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFileTypes: ['text/*', '.pdf', '.doc', '.docx']
      }
    });

    uppy.on('file-added', (file) => {
      // Handle file added
    });

    uppy.on('file-removed', (file) => {
      // Handle file removed
    });

    setUppyInstance(uppy);

    return () => {
      uppy.cancelAll();
      const fileIds = uppy.getFiles().map(f => f.id);
      uppy.removeFiles(fileIds);
    };
  }, []);

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

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'upload':
        return true; // Upload step is now optional
      case 'select-sources':
        return uploadedFiles.length > 0 || selectedKnowledgeBases.length > 0 || selectedAssets.length > 0;
      case 'process':
        return uploadedFiles.every(file => file.status.status === 'completed');
      case 'configure':
        return workflowSteps.every(step => 
          step.prompt_template_id && step.chat_model_id && step.persona_id
        );
      case 'review':
        return true;
      default:
        return false;
    }
  }, [currentStep, uploadedFiles, selectedKnowledgeBases, selectedAssets, workflowSteps]);

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <div className="space-y-4">
            {uppyInstance && (
              <Dashboard
                uppy={uppyInstance}
                proudlyDisplayPoweredByUppy={false}
                showProgressDetails
                height={400}
                showRemoveButtonAfterComplete={true}
                hideUploadButton={true}
                hideRetryButton={true}
                hideCancelButton={false}
                doneButtonHandler={null}
              />
            )}
          </div>
        );
      case 'select-sources':
        return (
          <div className="space-y-4">
            <KnowledgeBaseSelector
              knowledgeBases={knowledgeBases}
              isLoadingKnowledgeBases={isLoading}
              selectedKnowledgeBases={selectedKnowledgeBases}
              selectedAssets={selectedAssets}
              onSelectKnowledgeBase={(kb) => setSelectedKnowledgeBases(prev => [...prev, kb])}
              onDeselectKnowledgeBase={(kb) => setSelectedKnowledgeBases(prev => prev.filter(k => k.id !== kb.id))}
              onSelectAsset={(asset) => setSelectedAssets(prev => [...prev, asset])}
              onDeselectAsset={(asset) => setSelectedAssets(prev => prev.filter(a => a.id !== asset.id))}
            />
            <div className="mt-4">
              {selectedKnowledgeBases.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2">Selected Knowledge Bases</h3>
                  {selectedKnowledgeBases.map((kb) => (
                    <div key={kb.id} className="flex items-center justify-between p-2 border rounded mb-2">
                      <span>{kb.title}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedKnowledgeBases(prev => prev.filter(k => k.id !== kb.id))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {selectedAssets.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Selected Assets</h3>
                  {selectedAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between p-2 border rounded mb-2">
                      <span>{asset.title}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedAssets(prev => prev.filter(a => a.id !== asset.id))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case 'process':
        return (
          <FileProcessing
            totalTokens={totalTokens}
            maxTokens={MAX_TOKENS}
            uploadedFiles={uploadedFiles}
            onRemoveFile={handleRemoveFile}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />
        );
      case 'configure':
        return (
          <WorkflowSteps
            steps={workflowSteps}
            onUpdateStep={handleUpdateStep}
            onRemoveStep={handleRemoveStep}
            onAddStep={handleAddStep}
            promptTemplates={promptTemplates.map(t => ({
              id: String(t.id),
              title: t.title,
              prompt: t.prompt,
              // Include the full prompt template for preview
              _template: t
            }))}
            chatModels={chatModels.map(m => ({
              id: String(m.id),
              name: m.name,
              description: m.description || '',
              // Include the full chat model for preview
              _model: m
            }))}
            personas={personas.map(p => ({
              id: String(p.id),
              role: p.role
            }))}
          />
        );
      case 'review':
        return (
          <ReviewStep
            customInstructions={customInstructions}
            onInstructionsChange={setCustomInstructions}
            onPrevious={handlePrevious}
            onExecute={() => {
              handleExecute();
              setCurrentStep('results');
            }}
          />
        );
      case 'results':
        return (
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
            session={session!}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session || !uppyInstance) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <AppSidebar toggleChatbot={(modelId: string) => {}} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Batch Flow</h1>
            
            {/* Progress Steps */}
            <div className="mb-8">
              <ol className="flex items-center">
                {steps.map((step, i) => (
                  <li key={step.id} className="flex items-center">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                      currentStep === step.id ? 'bg-blue-500 border-blue-500 text-white' :
                      steps.findIndex(s => s.id === currentStep) > i ? 'bg-green-500 border-green-500 text-white' :
                      'border-gray-300 text-gray-500'
                    }`}>
                      {steps.findIndex(s => s.id === currentStep) > i ? '✓' : i + 1}
                    </div>
                    <span className="ml-2 text-sm">{step.label}</span>
                    {i < steps.length - 1 && (
                      <div className="w-12 h-px bg-gray-300 mx-2" />
                    )}
                  </li>
                ))}
              </ol>
            </div>

            {/* Current Step Content */}
            <div className="mb-6">
              {renderCurrentStep()}
            </div>

            {/* Navigation Buttons */}
            {currentStep !== 'results' && (
              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 'upload'}
                >
                  Previous
                </Button>
                {currentStep === 'review' ? (
                  <Button
                    onClick={() => {
                      handleExecute();
                      setCurrentStep('results');
                    }}
                    disabled={!canProceed}
                  >
                    Execute
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleNext}
                    disabled={!canProceed}
                  >
                    Next
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}