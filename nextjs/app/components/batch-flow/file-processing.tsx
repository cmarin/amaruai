'use client';

import { Button } from "@/components/ui/button";
import { FileVideo, X } from "lucide-react";
import type { UploadedFile } from "@/types";

interface FileProcessingProps {
  totalTokens: number;
  maxTokens: number;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (file: UploadedFile) => void;
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
  const tokenPercentage = (totalTokens / maxTokens) * 100;

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
