'use client';

import { Button } from "@/components/ui/button";
import { FileVideo, X, Copy, Check, Database, FileText } from "lucide-react";
import type { BatchFlowFile } from "@/types";
import type { KnowledgeBase } from '@/utils/knowledge-base-service';
import type { Asset } from '@/types/knowledge-base';
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FileProcessingProps {
  totalTokens: number;
  maxTokens: number;
  uploadedFiles: BatchFlowFile[];
  selectedKnowledgeBases: KnowledgeBase[];
  selectedAssets: Asset[];
  onRemoveFile: (file: BatchFlowFile) => void;
  onRemoveKnowledgeBase: (kb: KnowledgeBase) => void;
  onRemoveAsset: (asset: Asset) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function FileProcessing({
  totalTokens,
  maxTokens,
  uploadedFiles,
  selectedKnowledgeBases,
  selectedAssets,
  onRemoveFile,
  onRemoveKnowledgeBase,
  onRemoveAsset,
  onPrevious,
  onNext,
}: FileProcessingProps) {
  const { toast } = useToast();
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const tokenPercentage = (totalTokens / maxTokens) * 100;

  const handleCopyTranscript = async (file: BatchFlowFile) => {
    try {
      const content = file.status.content;
      if (!content) {
        console.error('No transcript available to copy');
        toast({
          title: "No transcript available",
          description: "The file is still being processed or has no transcript",
          variant: "destructive",
        });
        return;
      }

      await navigator.clipboard.writeText(content);
      setCopiedFileId(file.status.id);
      setTimeout(() => setCopiedFileId(null), 2000);
      toast({
        title: "Copied to clipboard",
        description: "Transcript has been copied to your clipboard",
      });
    } catch (error) {
      console.error('Error copying transcript:', error);
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

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

      <div className="space-y-6">
        {uploadedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="text-lg font-semibold">Processing Files:</div>
            {uploadedFiles.map((file: BatchFlowFile, index) => (
          <div 
            key={file.uploadURL || index}
            className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
          >
            <FileVideo className="w-5 h-5 text-blue-500" />
            <div className="flex-1">
              <div className="font-medium">{file.file_name}</div>
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
            <div className="flex items-center space-x-2">
              {file.status.status === 'completed' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyTranscript(file)}
                        className="h-8 w-8"
                      >
                        {copiedFileId === file.status.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy transcript</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <button
                onClick={() => onRemoveFile(file)}
                className="p-1 hover:bg-gray-200 rounded-full"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
            ))}
          </div>
        )}

        {selectedKnowledgeBases.length > 0 && (
          <div className="space-y-3">
            <div className="text-lg font-semibold">Selected Knowledge Bases:</div>
            {selectedKnowledgeBases.map((kb) => (
              <div 
                key={kb.id}
                className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
              >
                <Database className="w-5 h-5 text-blue-500" />
                <div className="flex-1">
                  <div className="font-medium">{kb.title}</div>
                  {kb.description && (
                    <div className="text-sm text-muted-foreground line-clamp-2">{kb.description}</div>
                  )}
                </div>
                <button
                  onClick={() => onRemoveKnowledgeBase(kb)}
                  className="p-1 hover:bg-gray-200 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedAssets.length > 0 && (
          <div className="space-y-3">
            <div className="text-lg font-semibold">Selected Assets:</div>
            {selectedAssets.map((asset) => (
              <div 
                key={asset.id}
                className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
              >
                <FileText className="w-5 h-5 text-blue-500" />
                <div className="flex-1">
                  <div className="font-medium">{asset.title}</div>
                </div>
                <button
                  onClick={() => onRemoveAsset(asset)}
                  className="p-1 hover:bg-gray-200 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}
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
          disabled={
            (uploadedFiles.length > 0 && !uploadedFiles.every((f: BatchFlowFile) => 
              ['completed', 'failed', 'max_attempts_exceeded'].includes(f.status.status)
            )) && selectedKnowledgeBases.length === 0 && selectedAssets.length === 0
          }
        >
          Next
        </Button>
      </div>
    </div>
  );
}
