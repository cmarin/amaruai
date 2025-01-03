'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from '@/app/utils/session/session';
import { useData } from '@/components/data-context';
import { UploadService, type UploadedFile } from '@/utils/upload-service';
import { BatchFlowStep, executeBatchFlow } from '@/utils/batch-flow-service';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';
import Dashboard from '@uppy/react/lib/Dashboard';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';

type WizardStep = 'upload' | 'workflow' | 'instructions' | 'processing';

const steps = [
  { id: 'upload', label: '1. Upload Files' },
  { id: 'workflow', label: '2. Configure Workflow' },
  { id: 'instructions', label: '3. Custom Instructions' },
  { id: 'processing', label: '4. Processing' }
];

export default function BatchFlow() {
  const { session } = useSession();
  const supabase = useSupabase();
  const { promptTemplates, chatModels, personas } = useData();
  const { sidebarOpen } = useSidebar();
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<BatchFlowStep[]>([{
    prompt_template_id: '',
    chat_model_id: '',
    persona_id: ''
  }]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  const handleFileUpload = useCallback((file: UploadedFile) => {
    setUploadedFiles(prev => [...prev, file]);
  }, []);

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
    setCurrentStep('processing');

    try {
      await executeBatchFlow(
        {
          files: uploadedFiles,
          steps: workflowSteps,
          customInstructions
        },
        session.access_token,
        (message) => {
          if (message.type === 'progress') {
            setProcessingStatus(
              `Processing ${message.fileName} (${message.currentStep}/${message.totalSteps})`
            );
          }
        },
        (error) => {
          console.error('Batch flow error:', error);
          setProcessingStatus(`Error: ${error.message}`);
        },
        () => {
          setProcessingStatus('Processing complete!');
          setIsProcessing(false);
        }
      );
    } catch (error) {
      console.error('Failed to execute batch flow:', error);
      setProcessingStatus('Failed to execute batch flow');
      setIsProcessing(false);
    }
  }, [session, uploadedFiles, workflowSteps, customInstructions]);

  const uppy = React.useMemo(() => {
    if (!session) return null;
    return UploadService.createUppy(
      'batch-flow-uploader',
      {},
      handleFileUpload,
      () => setCurrentStep('workflow'),
      supabase
    );
  }, [session, handleFileUpload]);

  const handleNext = useCallback(() => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id as WizardStep);
    }
  }, [currentStep]);

  const handlePrevious = useCallback(() => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as WizardStep);
    }
  }, [currentStep]);

  if (!session || !uppy) return null;

  return (
    <div className="flex h-screen">
      <AppSidebar toggleChatbot={() => {}} />
      <div className={`flex-1 overflow-hidden transition-all ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="container mx-auto p-6">
          <h1 className="text-2xl font-bold mb-6">Batch Flow</h1>

          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  {index > 0 && (
                    <div className="h-[2px] w-8 bg-blue-200" />
                  )}
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      currentStep === step.id
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-blue-200 text-blue-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          <Card className="mt-4">
            <CardContent className="pt-6">
              {currentStep === 'upload' && (
                <div>
                  <Dashboard
                    uppy={uppy}
                    proudlyDisplayPoweredByUppy={false}
                    showProgressDetails
                    height={400}
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

              {currentStep === 'workflow' && (
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

              {currentStep === 'instructions' && (
                <div>
                  <Textarea
                    placeholder="Enter any custom instructions for processing..."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    className="min-h-[200px]"
                  />

                  <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={handlePrevious}>
                      Previous
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleExecute}
                    >
                      Start Processing
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 'processing' && (
                <div className="space-y-4">
                  <div className="text-lg font-medium text-blue-500">{processingStatus}</div>
                  {isProcessing && (
                    <div className="flex items-center justify-center p-4">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  
                  <div className="flex justify-between mt-4">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={isProcessing}
                    >
                      Previous
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
