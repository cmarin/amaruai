'use client';

import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from '@/app/utils/session/session';
import { useData } from '@/components/data-context';
import { UploadService, type UploadedFile } from '@/utils/upload-service';
import { BatchFlowStep, executeBatchFlow } from '@/utils/batch-flow-service';
import Dashboard from '@uppy/react/lib/Dashboard';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { useSupabase } from '@/app/contexts/SupabaseContext';

type WizardStep = 'upload' | 'workflow' | 'instructions' | 'processing';

export default function BatchFlow() {
  const { session } = useSession();
  const supabase = useSupabase();
  const { promptTemplates, chatModels, personas } = useData();
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<BatchFlowStep[]>([]);
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
    setWorkflowSteps(prev => prev.filter((_, i) => i !== index));
  }, []);

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

  if (!session || !uppy) return null;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Batch Flow</h1>

      <Tabs value={currentStep} onValueChange={(value) => setCurrentStep(value as WizardStep)}>
        <TabsList>
          <TabsTrigger value="upload">1. Upload Files</TabsTrigger>
          <TabsTrigger value="workflow">2. Configure Workflow</TabsTrigger>
          <TabsTrigger value="instructions">3. Custom Instructions</TabsTrigger>
          <TabsTrigger value="processing">4. Processing</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardContent className="pt-6">
              <Dashboard
                uppy={uppy}
                proudlyDisplayPoweredByUppy={false}
                showProgressDetails
                height={400}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {workflowSteps.map((step, index) => (
                  <div key={index} className="flex gap-4 items-start">
                    <Select
                      value={step.prompt_template_id}
                      onValueChange={(value) => handleUpdateStep(index, 'prompt_template_id', value)}
                    >
                      <SelectTrigger className="w-[200px]">
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

                    <Select
                      value={step.chat_model_id}
                      onValueChange={(value) => handleUpdateStep(index, 'chat_model_id', value)}
                    >
                      <SelectTrigger className="w-[200px]">
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

                    <Select
                      value={step.persona_id}
                      onValueChange={(value) => handleUpdateStep(index, 'persona_id', value)}
                    >
                      <SelectTrigger className="w-[200px]">
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

                    <Button
                      variant="destructive"
                      onClick={() => handleRemoveStep(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}

                <Button onClick={handleAddStep}>Add Step</Button>

                {workflowSteps.length > 0 && (
                  <Button
                    className="ml-4"
                    onClick={() => setCurrentStep('instructions')}
                  >
                    Next
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructions">
          <Card>
            <CardContent className="pt-6">
              <Textarea
                placeholder="Enter any custom instructions for processing..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="min-h-[200px]"
              />

              <div className="mt-4 space-x-4">
                <Button onClick={() => setCurrentStep('workflow')}>Back</Button>
                <Button onClick={handleExecute}>Start Processing</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processing">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="text-lg">{processingStatus}</div>
                {isProcessing && (
                  <div className="animate-pulse">Processing...</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
