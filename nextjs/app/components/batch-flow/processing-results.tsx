'use client';

import { Button } from "@/components/ui/button";
import type { UploadedFile } from "@/types";

interface ProcessingResultsProps {
  isProcessing: boolean;
  processingStatus: string;
  fileResponses: Record<string, string>;
  uploadedFiles: UploadedFile[];
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
      <div className="text-lg font-semibold mb-4">Processing Results</div>
      
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
                className="p-4 border rounded-lg bg-white"
              >
                <div className="font-medium mb-2">{file?.status.file_name}</div>
                <div className="text-sm text-gray-600 whitespace-pre-wrap">
                  {response}
                </div>
              </div>
            );
          })}

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
      )}
    </div>
  );
}
