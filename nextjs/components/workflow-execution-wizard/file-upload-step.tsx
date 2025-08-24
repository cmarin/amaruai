'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, X, Upload } from 'lucide-react';
import { WorkflowAssetUploader } from '@/components/workflow-asset-uploader';
import { WizardStepProps } from '@/types/workflow-wizard';
import { UploadedFile } from '@/utils/upload-service';
import { useToast } from "@/hooks/use-toast";

interface FileUploadStepProps extends WizardStepProps {}

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
    <div className="space-y-6">
      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Upload Files</h2>
        <p className="text-gray-600">
          Upload files that will be included in your workflow execution. 
          These files will be processed and made available to all workflow steps.
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
        <WorkflowAssetUploader
          key={`wizard-uploader-${Date.now()}`}
          onFileUploaded={handleFileUploaded}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          knowledgeBaseId={undefined} // Use default storage folder
        />
      </div>

      {wizardState.uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Uploaded Files ({wizardState.uploadedFiles.length})</h3>
          <ScrollArea className="h-[200px] border rounded-lg p-4">
            <div className="space-y-2">
              {wizardState.uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
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

      <div className="flex justify-between pt-6 border-t">
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