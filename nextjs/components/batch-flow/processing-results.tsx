'use client';

import { Button } from "@/components/ui/button";
import { GeneratingButton } from "./generating-button";
import type { BatchFlowFile } from "@/types";

interface ProcessingResultsProps {
  isProcessing: boolean;
  processingStatus: string;
  fileResponses: Record<string, string>;
  uploadedFiles: BatchFlowFile[];
  onPrevious: () => void;
  onStartNewBatch: () => void;
}

export function ProcessingResults({
  isProcessing,
  processingStatus,
  fileResponses,
  uploadedFiles,
  onPrevious,
  onStartNewBatch,
}: ProcessingResultsProps) {
  return (
    <div className="space-y-6">
      <GeneratingButton isGenerating={isProcessing} />
      
      {isProcessing ? (
        <div className="text-center py-8">
          <div className="mb-4 text-gray-600">{processingStatus}</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(fileResponses).map(([fileId, response]) => {
            const file = uploadedFiles.find(f => f.status.id === fileId);
            return (
              <div 
                key={fileId}
                className="p-4 border rounded-lg bg-white space-y-4"
              >
                <div className="font-medium">{file?.status.file_name}</div>
                <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                  <div>
                    <div className="font-semibold">Model</div>
                    <div>{file?.status.model?.name || 'Unknown Model'}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Persona</div>
                    <div>{file?.status.persona?.role || 'Unknown Persona'}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Template</div>
                    <div>{file?.status.template?.name || 'Unknown Template'}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 whitespace-pre-wrap">
                  {response}
                </div>
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
