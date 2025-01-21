'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import { Loader2, Copy, BookMarked } from 'lucide-react';
import type { BatchFlowStep, BatchFlowFile } from '@/types';
import { useData } from "@/components/data-context";
import { useToast } from "@/hooks/use-toast";
import { addToScratchPad } from "@/utils/scratch-pad-service";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StreamingResultsProps {
  isProcessing: boolean;
  processingStatus: string;
  uploadedFiles: BatchFlowFile[];
  steps: BatchFlowStep[];
  customInstructions: string;
  onPrevious: () => void;
  onStartNewBatch: () => void;
  session: { access_token: string };
}

interface StepResult {
  stepIndex: number;
  fileId: string;
  content: string;
}

export function StreamingResults({
  isProcessing,
  processingStatus,
  uploadedFiles,
  steps,
  customInstructions,
  onPrevious,
  onStartNewBatch,
  session,
}: StreamingResultsProps) {
  const { toast } = useToast();
  const { promptTemplates, chatModels, personas } = useData();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [results, setResults] = useState<StepResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllers = useRef<AbortController[]>([]);
  const [rawContent, setRawContent] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!isProcessing) return;

    // Initialize abort controllers for each step
    abortControllers.current = steps.map(() => new AbortController());

    // Process all steps concurrently
    const processSteps = async () => {
      try {
        await Promise.all(steps.map((step, stepIndex) => processStep(step, stepIndex)));
      } catch (error) {
        console.error('Error processing steps:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    };

    const processStep = async (step: BatchFlowStep, stepIndex: number) => {
      try {
        const response = await fetch('/api/batch-flow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            file_ids: uploadedFiles.map(f => f.status.id),
            steps: [step],
            customInstructions,
          }),
          signal: abortControllers.current[stepIndex].signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to process batch flow step ${stepIndex + 1}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let stepContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '' || !line.startsWith('data: ')) continue;

            const jsonData = line.slice(5).trim();
            if (jsonData === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonData);
              if (parsed.choices && parsed.choices[0].delta.content) {
                const content = parsed.choices[0].delta.content;
                stepContent += content;

                // Update both raw content and parsed results
                setRawContent(prev => ({
                  ...prev,
                  [stepIndex]: stepContent
                }));

                try {
                  setResults(prev => {
                    const newResults = [...prev];
                    const existingIndex = newResults.findIndex(r => r.stepIndex === stepIndex);

                    if (existingIndex >= 0) {
                      newResults[existingIndex] = {
                        ...newResults[existingIndex],
                        content: stepContent,
                      };
                    } else {
                      newResults.push({
                        stepIndex,
                        fileId: uploadedFiles[0].status.id,
                        content: stepContent,
                      });
                    }

                    return newResults;
                  });
                } catch (parseError) {
                  console.error('Error updating parsed results:', parseError);
                }
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
              // Still update raw content even if parsing fails
              setRawContent(prev => ({
                ...prev,
                [stepIndex]: stepContent
              }));
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log(`Batch flow step ${stepIndex + 1} aborted`);
        } else {
          throw err;
        }
      }
    };

    processSteps();

    return () => {
      abortControllers.current.forEach(controller => controller.abort());
    };
  }, [isProcessing, steps, uploadedFiles, customInstructions, session.access_token]);

  const getStepResults = (stepIndex: number) => {
    // Combine all file results for this step into one string
    return results
      .filter(r => r.stepIndex === stepIndex)
      .map(r => r.content)
      .join('\n\n');
  };

  const getStepConfig = (step: BatchFlowStep) => {
    const model = chatModels.find(m => m.id === String(step.chat_model_id))?.name || 'Unknown Model';
    const persona = personas.find(p => p.id === String(step.persona_id))?.role || 'Unknown Persona';
    const template = promptTemplates.find(t => t.id === step.prompt_template_id)?.title || 'Unknown Template';
    
    return { model, persona, template };
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied to clipboard",
        description: "Content has been copied to your clipboard",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleAddToScratchPad = (content: string) => {
    addToScratchPad(content);
    toast({
      title: "Added to Scratch Pad",
      description: "Content has been added to your scratch pad",
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-lg font-semibold mb-4">Processing Results</div>
      
      {error ? (
        <div className="text-red-500 p-4 rounded-lg bg-red-50">
          Error: {error}
        </div>
      ) : (
        <div className="space-y-8">
          {steps.map((step, stepIndex) => {
            const config = getStepConfig(step);
            const stepContent = getStepResults(stepIndex);
            
            return (
              <div key={stepIndex} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="space-y-2">
                    <div className="font-medium">Step {stepIndex + 1}</div>
                    <div className="text-sm text-gray-600">
                      <div>Model: {config.model}</div>
                      <div>Persona: {config.persona}</div>
                      <div>Template: {config.template}</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(stepContent)}
                            className="h-8 w-8"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy transcript</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAddToScratchPad(stepContent)}
                            className="h-8 w-8"
                          >
                            <BookMarked className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Add to scratch pad</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                
                {stepIndex === currentStepIndex && isProcessing && (
                  <div className="text-blue-500 flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </div>
                )}
                
                <ScrollArea className="h-[200px] w-full rounded border p-4 bg-gray-50">
                  <ReactMarkdown>
                    {getStepResults(stepIndex) || rawContent[stepIndex] || ''}
                  </ReactMarkdown>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={onStartNewBatch}
        >
          Start New Batch
        </Button>
      </div>
    </div>
  );
}
