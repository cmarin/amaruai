'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, X, Upload } from 'lucide-react';
import { WorkflowAssetUploader } from '@/components/workflow-asset-uploader';
import { WizardStepProps } from '@/types/workflow-wizard';
import { UploadedFile } from '@/utils/upload-service';
import { useToast } from "@/hooks/use-toast";

type FileUploadStepProps = WizardStepProps;

export function FileUploadStep({
  workflow,
  wizardState,
  onStateChange,
  onNext,
  onPrevious,
  isFirst,
  isLast
}: FileUploadStepProps) {
  const { toast } = useToast();

  const handleFileUploaded = useCallback((file: UploadedFile) => {
    onStateChange({
      uploadedFiles: [...wizardState.uploadedFiles, file]
    });
  }, [wizardState.uploadedFiles, onStateChange]);

  const handleUploadComplete = useCallback((result: any) => {
    // Files are already tracked via handleFileUploaded
    // This is just a completion signal
  }, []);

  const removeFile = useCallback((fileId: string) => {
    onStateChange({
      uploadedFiles: wizardState.uploadedFiles.filter(f => f.id !== fileId)
    });
  }, [wizardState.uploadedFiles, onStateChange]);

  const handleUploadError = useCallback((error: Error) => {
    toast({
      title: "Upload Error",
      description: error.message,
      variant: "destructive"
    });
  }, [toast]);

  return (
    <div className="space-y-3">
      <div className="pb-24">
        <div className="rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
          <WorkflowAssetUploader
            key={`wizard-uploader-${Date.now()}`}
            onFileUploaded={handleFileUploaded}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            knowledgeBaseId={undefined}
          />
        </div>

        {wizardState.uploadedFiles.length > 0 && (
          <div className="space-y-2 mt-3">
            <h3 className="text-base font-semibold">Uploaded Files ({wizardState.uploadedFiles.length})</h3>
            <ScrollArea className="h-[140px] border rounded-lg p-3">
              <div className="space-y-2">
                {wizardState.uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {file.size > 1024 * 1024
                            ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
                            : (file.size / 1024).toFixed(1) + ' KB'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-20 flex justify-between pt-3 border-t bg-white dark:bg-gray-900">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={isFirst}
          className="min-w-[100px]"
        >
          Previous
        </Button>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={onNext}
            className="min-w-[100px]"
          >
            {wizardState.uploadedFiles.length > 0 ? 'Continue' : 'Skip'}
          </Button>
        </div>
      </div>
    </div>
  );
}