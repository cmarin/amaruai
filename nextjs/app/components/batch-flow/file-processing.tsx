'use client';

import { Button } from "@/components/ui/button";
import { FileVideo, X } from "lucide-react";
import type { BatchFlowFile } from "@/types";
import { useEffect } from "react";
import { getAssetStatus } from "@/utils/batch-flow-service";
import { useSession } from "@/app/utils/session/session";

interface FileProcessingProps {
  totalTokens: number;
  maxTokens: number;
  uploadedFiles: BatchFlowFile[];
  onRemoveFile: (file: BatchFlowFile) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function FileProcessing({
  totalTokens,
  maxTokens,
  uploadedFiles,
  onRemoveFile,
  onPrevious,
  onNext,
}: FileProcessingProps) {
  const { session } = useSession();
  const tokenPercentage = (totalTokens / maxTokens) * 100;

  useEffect(() => {
    if (!session || uploadedFiles.length === 0) return;

    const pollInterval = setInterval(async () => {
      const updatedFiles = await Promise.all(
        uploadedFiles.map(async (file) => {
          if (!file.status.id) return file;
          try {
            const status = await getAssetStatus(file.status.id, session.access_token);
            return {
              ...file,
              status
            };
          } catch (error) {
            console.error(`Failed to get status for file ${file.file_name}:`, error);
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
        // Update the parent component's state
        const newFiles = [...updatedFiles];
        uploadedFiles.forEach((file, index) => {
          if (newFiles[index].status.id === file.status.id) {
            newFiles[index] = {
              ...file,
              status: updatedFiles[index].status
            };
          }
        });
        // Notify parent of file updates
        newFiles.forEach(file => {
          if (file !== uploadedFiles.find(f => f.status.id === file.status.id)) {
            onRemoveFile(file);
            onRemoveFile(file);
          }
        });
      }

      // Stop polling if all files are processed
      if (updatedFiles.every(
        file => ['completed', 'max_attempts_exceeded', 'failed'].includes(file.status.status)
      )) {
        clearInterval(pollInterval);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [session, uploadedFiles, onRemoveFile]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          Token Usage: {totalTokens.toLocaleString()} of {maxTokens.toLocaleString()}
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
              onClick={() => onRemoveFile(file)}
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
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={onNext}
          disabled={!uploadedFiles.every(f => 
            ['completed', 'failed', 'max_attempts_exceeded'].includes(f.status.status)
          )}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
