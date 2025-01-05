'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import { Loader2 } from 'lucide-react';
import type { BatchFlowStep, BatchFlowUploadedFile } from '@/types';

interface StreamingResultsProps {
  isProcessing: boolean;
  processingStatus: string;
  uploadedFiles: BatchFlowUploadedFile[];
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [results, setResults] = useState<StepResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isProcessing) return;

    const processStep = async (stepIndex: number) => {
      try {
        abortController.current = new AbortController();
        const response = await fetch('/api/batch-flow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            file_ids: uploadedFiles.map(f => f.status.id),
            steps: [steps[stepIndex]],
            customInstructions,
          }),
          signal: abortController.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to process batch flow step');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        // Initialize empty content for each file
        const fileContents: Record<string, string> = {};
        uploadedFiles.forEach(file => {
          fileContents[file.status.id] = '';
        });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonData = line.slice(5).trim();
            if (jsonData === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonData);
              if (parsed.choices && parsed.choices[0].delta.content) {
                const currentFileId = uploadedFiles[0].status.id; // TODO: Handle multiple files
                fileContents[currentFileId] += parsed.choices[0].delta.content;

                // Update results with the latest content
                setResults(prev => {
                  const existingResult = prev.find(
                    r => r.stepIndex === stepIndex && r.fileId === currentFileId
                  );

                  if (existingResult) {
                    return prev.map(r =>
                      r.stepIndex === stepIndex && r.fileId === currentFileId
                        ? { ...r, content: fileContents[currentFileId] }
                        : r
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        stepIndex,
                        fileId: currentFileId,
                        content: fileContents[currentFileId],
                      },
                    ];
                  }
                });
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }

        // Move to next step
        if (stepIndex < steps.length - 1) {
          setCurrentStepIndex(stepIndex + 1);
          await processStep(stepIndex + 1);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Batch flow processing aborted');
        } else {
          console.error('Error processing batch flow step:', err);
          setError(err instanceof Error ? err.message : 'Unknown error occurred');
        }
      }
    };

    processStep(currentStepIndex);

    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [isProcessing, currentStepIndex, steps, uploadedFiles, customInstructions, session.access_token]);

  const getStepResults = (stepIndex: number, fileId: string) => {
    return results.find(r => r.stepIndex === stepIndex && r.fileId === fileId)?.content || '';
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
          {steps.map((step, stepIndex) => (
            <div key={stepIndex} className="border rounded-lg p-4">
              <div className="font-medium mb-4">
                Step {stepIndex + 1}
                {stepIndex === currentStepIndex && isProcessing && (
                  <span className="ml-2 text-blue-500 inline-flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                {uploadedFiles.map((file) => (
                  <div key={file.status.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="font-medium mb-2">{file.status.file_name}</div>
                    <ScrollArea className="h-[200px] w-full rounded border p-4">
                      <ReactMarkdown>
                        {getStepResults(stepIndex, file.status.id)}
                      </ReactMarkdown>
                    </ScrollArea>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
