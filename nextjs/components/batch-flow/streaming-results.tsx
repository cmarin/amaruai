'use client';

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import { Loader2, Copy, BookMarked } from 'lucide-react';
import type { BatchFlowStep, BatchFlowFile } from '@/types';
import type { KnowledgeBase } from '@/utils/knowledge-base-service';
import type { Asset } from '@/types/knowledge-base';
import { useData } from "@/components/data-context";
import { useToast } from "@/hooks/use-toast";
import { addToScratchPad } from "@/utils/scratch-pad-service";
import { GeneratingButton } from "./generating-button";
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
  selectedKnowledgeBases: KnowledgeBase[];
  selectedAssets: Asset[];
  steps: BatchFlowStep[];
  customInstructions: string;
  onPrevious: () => void;
  onStartNewBatch: () => void;
  onProcessingChange: (processing: boolean) => void;
  session: { access_token: string };
}

interface StepResult {
  stepIndex: number;
  content: string;
}

export function StreamingResults({
  isProcessing,
  processingStatus,
  uploadedFiles,
  selectedKnowledgeBases,
  selectedAssets,
  steps,
  customInstructions,
  onPrevious,
  onStartNewBatch,
  onProcessingChange,
  session,
}: StreamingResultsProps) {
  const { toast } = useToast();
  const { promptTemplates, chatModels, personas } = useData();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [results, setResults] = useState<StepResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isProcessing) return;
    
    // Clear results when starting a new batch
    setResults([]);
    
    // Create a map to store content for each step
    const stepContents = new Map<number, string>();
    
    const processStream = async () => {
      try {
        // Create a request for each step
        const stepRequests = steps.map((step, stepIndex) => 
          fetch('/api/batch-flow', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              file_ids: uploadedFiles.map(file => file.status.id),
              knowledge_base_ids: selectedKnowledgeBases.map(kb => kb.id),
              asset_ids: selectedAssets.map(asset => asset.id),
              steps: [step], // Send one step at a time
              customInstructions
            }),
          })
        );

        // Execute all requests in parallel
        const responses = await Promise.all(stepRequests);
        
        // Process each response stream
        const readers = responses.map(async (response, stepIndex) => {
          if (!response.ok) {
            const errorData = await response.json();
            console.error(`Batch flow error for step ${stepIndex}:`, errorData);
            throw new Error(
              errorData.details?.message || 
              errorData.details || 
              errorData.error || 
              'Failed to execute batch flow'
            );
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let buffer = '';
          stepContents.set(stepIndex, '');

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
                if (parsed.choices?.[0]?.delta) {
                  if (parsed.choices[0].delta.content) {
                    const currentContent = stepContents.get(stepIndex) || '';
                    const newContent = currentContent + parsed.choices[0].delta.content;
                    stepContents.set(stepIndex, newContent);
                    
                    // Update results with all current step contents
                    const newResults = Array.from(stepContents.entries()).map(([index, content]) => ({
                      stepIndex: index,
                      content
                    }));
                    setResults(newResults);
                  }
                  if (parsed.choices[0].finish_reason === 'stop') {
                    // Only set processing to false when all steps are complete
                    const allComplete = Array.from(stepContents.values()).every(content => content.length > 0);
                    if (allComplete) {
                      onProcessingChange(false);
                    }
                  }
                }
              } catch (err) {
                console.error('Error parsing SSE message:', err);
              }
            }
          }
        });

        // Wait for all streams to complete
        await Promise.all(readers);
      } catch (error) {
        console.error('Error processing stream:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        onProcessingChange(false);
      }
    };

    processStream();
  }, [isProcessing, session.access_token, uploadedFiles, selectedKnowledgeBases, selectedAssets, steps, customInstructions]);

  const getStepResults = (stepIndex: number) => {
    // Combine all file results for this step into one string
    return results
      .filter(r => r.stepIndex === stepIndex)
      .map(r => r.content)
      .join('\n\n');
  };

  const getStepConfig = (step: BatchFlowStep) => {
    const model = chatModels.find(m => String(m.id) === String(step.chat_model_id))?.name || 'Unknown Model';
    const persona = personas.find(p => String(p.id) === String(step.persona_id))?.role || 'Unknown Persona';
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
    <div className="space-y-4">
      {isProcessing && <GeneratingButton isGenerating={isProcessing} />}
      
      {error ? (
        <div className="text-red-500 dark:text-red-400 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
          Error: {error}
        </div>
      ) : (
        <div className="space-y-8">
          {steps.map((step, stepIndex) => {
            const config = getStepConfig(step);
            const stepContent = getStepResults(stepIndex);
            
            return (
              <div key={stepIndex} className="border rounded-lg p-4 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <div className="space-y-2">
                    <div className="font-medium dark:text-gray-200">Step {stepIndex + 1}</div>
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div>
                        <div className="font-semibold dark:text-gray-300">Model</div>
                        <div>{config.model}</div>
                      </div>
                      <div>
                        <div className="font-semibold dark:text-gray-300">Persona</div>
                        <div>{config.persona}</div>
                      </div>
                      <div>
                        <div className="font-semibold dark:text-gray-300">Template</div>
                        <div>{config.template}</div>
                      </div>
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
                          <p>Copy</p>
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
                  <div className="text-blue-500 dark:text-blue-400 flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </div>
                )}
                
                <ScrollArea className="h-[200px] w-full rounded border p-4 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                  <ReactMarkdown className="text-gray-900 dark:text-gray-200">
                    {stepContent}
                  </ReactMarkdown>
                </ScrollArea>
              </div>
            );
          })}

          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={onStartNewBatch}
            >
              Start New Batch
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
