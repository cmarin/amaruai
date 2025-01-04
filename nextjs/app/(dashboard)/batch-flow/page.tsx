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
import { FileVideo, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAssetStatus, executeBatchFlow, type BatchFlowStreamMessage } from '@/utils/batch-flow-service';
import { UploadService } from '@/utils/upload-service';
import type { UploadedFile, FileStatus, BatchFlowStep } from '@/types';

const MAX_TOKENS = 100000;

type WizardStep = 'upload' | 'process' | 'configure' | 'review';

const steps: { id: WizardStep; label: string }[] = [
  { id: 'upload', label: 'Upload Files' },
  { id: 'process', label: 'Process Files' },
  { id: 'configure', label: 'Configure Workflow' },
  { id: 'review', label: 'Review & Start' },
];

export default function BatchFlow() {
  const { session } = useSession();
  const supabase = useSupabase();
  const { promptTemplates, chatModels, personas } = useData();
  const { sidebarOpen } = useSidebar();
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<FileStatus[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<BatchFlowStep[]>([{
    prompt_template_id: '',
    chat_model_id: '',
    persona_id: ''
  }]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  const totalTokens = uploadedFiles.reduce((sum, file) => sum + (file.status.token_count || 0), 0);
  const tokenPercentage = Math.min((totalTokens / MAX_TOKENS) * 100, 100);

  // Start polling when entering the process step
  useEffect(() => {
    if (currentStep !== 'process' || !session) return;

    const intervals: NodeJS.Timeout[] = [];

    uploadedFiles.forEach(file => {
      if (!file.url) return;

      const interval = setInterval(async () => {
        try {
          const status = await getAssetStatus(file.url || '', session.access_token);
          setUploadedFiles(prev => prev.map(f => {
            if (f.url === file.url) {
              return { ...f, status };
            }
            return f;
          }));

          // If all files are complete, stop polling
          if (status.status === 'completed' || 
              status.status === 'failed' || 
              status.status === 'max_attempts_exceeded') {
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Failed to fetch asset status:', error);
        }
      }, 3000);

      intervals.push(interval);
    });

    return () => {
      intervals.forEach(clearInterval);
    };
  }, [currentStep, session, uploadedFiles]);

  const handleFileUpload = useCallback((file: UploadedFile) => {
    const fileStatus: FileStatus = {
      ...file,
      status: {
        id: '',
        status: 'pending',
        token_count: 0,
        file_name: file.name
      }
    };
    setUploadedFiles(prev => [...prev, fileStatus]);
  }, []);

  const handleRemoveFile = useCallback((fileToRemove: FileStatus) => {
    setUploadedFiles(prev => prev.filter(file => file.url !== fileToRemove.url));
  }, []);

  const uppy = React.useMemo(() => {
    if (!session) return null;

    const uppyInstance = UploadService.createUppy(
      'batch-flow-uploader',
      {},
      handleFileUpload,
      undefined,
      supabase
    );

    return uppyInstance;
  }, [session, handleFileUpload, supabase]);

  const handleNext = useCallback(() => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id);
    }
  }, [currentStep]);

  const handlePrevious = useCallback(() => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id);
    }
  }, [currentStep]);

  const handleStepClick = useCallback((stepId: WizardStep) => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    const targetIndex = steps.findIndex(step => step.id === stepId);
    
    // Prevent skipping steps
    if (targetIndex > currentIndex && !uploadedFiles.length) {
      return;
    }
    
    setCurrentStep(stepId);
  }, [currentStep, uploadedFiles]);

  const handleAddStep = useCallback(() => {
    setWorkflowSteps(prev => [
      ...prev,
      {
        prompt_template_id: '',
        chat_model_id: '',
        persona_id: ''
      }
    ]);
  }, []);

  const handleUpdateStep = useCallback((index: number, field: keyof BatchFlowStep, value: string) => {
    setWorkflowSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = { ...newSteps[index], [field]: value };
      return newSteps;
    });
  }, []);

  const handleRemoveStep = useCallback((index: number) => {
    if (workflowSteps.length > 1) {
      setWorkflowSteps(prev => prev.filter((_, i) => i !== index));
    }
  }, [workflowSteps.length]);

  const handleExecute = useCallback(async () => {
    if (!session) return;
    
    setIsProcessing(true);
    
    try {
      await executeBatchFlow(
        {
          file_ids: uploadedFiles.map(file => file.status.id),
          steps: workflowSteps,
          customInstructions
        },
        session.access_token,
        (message: BatchFlowStreamMessage) => {
          if (message.type === 'progress') {
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
    }
  }, [session, uploadedFiles, workflowSteps, customInstructions]);

  if (!session || !uppy) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <AppSidebar toggleChatbot={() => {}} />
      <div className={`flex-1 overflow-hidden transition-all ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="container mx-auto p-6">
          <h1 className="text-2xl font-bold mb-6">Batch Flow</h1>

          <div className="flex justify-center mb-8">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => handleStepClick(step.id)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step.id === currentStep
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-blue-500 border border-blue-500'
                  }`}
                >
                  {index + 1}
                </button>
                {index < steps.length - 1 && (
                  <div className="w-16 h-px bg-gray-300 mx-2 mt-4" />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="border rounded-lg p-4">
            {currentStep === 'upload' && (
              <div>
                <Dashboard
                  uppy={uppy}
                  proudlyDisplayPoweredByUppy={false}
                  showProgressDetails
                  height={400}
                  showRemoveButtonAfterComplete={true}
                  hideUploadButton={false}
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
                    variant="default"
                    onClick={handleNext}
                    disabled={uploadedFiles.length === 0}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'process' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    Token Usage: {totalTokens.toLocaleString()} of {MAX_TOKENS.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {tokenPercentage.toFixed(0)}% used
                  </div>
                </div>
                
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${tokenPercentage}%` }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="text-lg font-semibold">Processing Files:</div>
                  {uploadedFiles.map((file, index) => (
                    <div 
                      key={file.url || index}
                      className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
                    >
                      <FileVideo className="w-5 h-5 text-blue-500" />
                      <div className="flex-1">
                        <div className="font-medium">{file.status.file_name}</div>
                        <div className="flex items-center space-x-2 text-sm">
                          <span>Status: </span>
                          <span className={
                            file.status.status === 'completed' ? 'text-green-500' :
                            file.status.status === 'failed' ? 'text-red-500' :
                            file.status.status === 'max_attempts_exceeded' ? 'text-orange-500' :
                            'text-blue-500'
                          }>
                            {file.status.status}
                          </span>
                          <span>•</span>
                          <span>Tokens: {file.status.token_count.toLocaleString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(file)}
                        className="p-1 hover:bg-gray-200 rounded-full"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between mt-4">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleNext}
                    disabled={!uploadedFiles.every(f => 
                      ['completed', 'failed', 'max_attempts_exceeded'].includes(f.status.status)
                    )}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'configure' && (
              <div className="space-y-6">
                {workflowSteps.map((step, index) => (
                  <div key={index} className="flex gap-4 items-start p-4 border rounded-lg bg-slate-50">
                    <div className="space-y-4 flex-1">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Prompt Template</label>
                          <Select
                            value={step.prompt_template_id}
                            onValueChange={(value) => handleUpdateStep(index, 'prompt_template_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select prompt" />
                            </SelectTrigger>
                            <SelectContent>
                              {promptTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Chat Model</label>
                          <Select
                            value={step.chat_model_id}
                            onValueChange={(value) => handleUpdateStep(index, 'chat_model_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {chatModels.map((model) => (
                                <SelectItem key={model.id} value={model.id.toString()}>
                                  {model.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Persona</label>
                          <Select
                            value={step.persona_id}
                            onValueChange={(value) => handleUpdateStep(index, 'persona_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select persona" />
                            </SelectTrigger>
                            <SelectContent>
                              {personas.map((persona) => (
                                <SelectItem key={persona.id} value={persona.id.toString()}>
                                  {persona.role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="destructive"
                      onClick={() => handleRemoveStep(index)}
                      disabled={workflowSteps.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={handleAddStep}
                  className="mt-4"
                >
                  Add Step
                </Button>

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={handlePrevious}>
                    Previous
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleNext}
                    disabled={!workflowSteps.some(step => 
                      step.prompt_template_id && step.chat_model_id && step.persona_id
                    )}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'review' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Custom Instructions (Optional)</label>
                  <Textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Add any custom instructions for processing..."
                    className="h-32"
                  />
                </div>

                <div className="flex justify-between mt-4">
                  <Button variant="outline" onClick={handlePrevious}>
                    Previous
                  </Button>
                  <Button variant="default" onClick={handleExecute}>
                    Execute
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
