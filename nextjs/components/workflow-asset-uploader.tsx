'use client';

import { useEffect, useState, useRef } from 'react';
import { Dashboard } from '@uppy/react';
import Uppy from '@uppy/core';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { UploadService, UploadedFile } from '@/utils/upload-service';
import { useToast } from "@/hooks/use-toast"
import { derror } from '@/utils/debug';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';

interface WorkflowAssetUploaderProps {
  onFileUploaded?: (file: UploadedFile) => void;
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: Error) => void;
  knowledgeBaseId?: string;
}

export function WorkflowAssetUploader({ 
  onFileUploaded, 
  onUploadComplete, 
  onUploadError, 
  knowledgeBaseId 
}: WorkflowAssetUploaderProps) {
  const [uppy, setUppy] = useState<ReturnType<typeof UploadService.createUppy> | null>(null);
  const supabase = useSupabase();
  const { toast } = useToast();
  const uploadedFilesRef = useRef<UploadedFile[]>([]);

  useEffect(() => {
    // Reset uploaded files when component mounts
    uploadedFilesRef.current = [];

    const uppyInstance = UploadService.createUppy(
      `workflow-asset-uploader-${Date.now()}`,
      {
        maxFiles: 10,
        storageFolder: knowledgeBaseId ? `knowledge-bases/${knowledgeBaseId}` : 'assets',
        storageBucket: 'amaruai-dev',
        restrictions: {
          maxFileSize: 10 * 1024 * 1024, // 10MB
          allowedFileTypes: [
            'image/*',
            'application/pdf',
            '.doc', '.docx',
            '.txt',
            '.md',
            'audio/*',
            'video/*'
          ]
        }
      },
      (file) => {
        // Track each file as it's uploaded
        uploadedFilesRef.current.push(file);
        
        // Notify parent of each file upload
        if (onFileUploaded) {
          onFileUploaded(file);
        }
        
        toast({
          title: "File uploaded",
          description: `Successfully uploaded ${file.name}`,
          duration: 2000, // Show for only 2 seconds
        });
      },
      (result) => {
        // When all uploads are complete, notify with all files
        if (onUploadComplete) {
          onUploadComplete(uploadedFilesRef.current);
        }
      },
      supabase,
      knowledgeBaseId
    );

    // Handle upload errors
    uppyInstance.on('upload-error', (file, error) => {
      derror(`Upload error for ${file?.name}:`, error);
      if (onUploadError) {
        onUploadError(error as Error);
      }
      toast({
        title: "Upload failed",
        description: `Failed to upload ${file?.name}: ${error?.message}`,
        variant: "destructive"
      });
    });

    setUppy(uppyInstance);

    return () => {
      if (uppyInstance) {
        uppyInstance.destroy();
      }
    };
  }, [supabase, knowledgeBaseId]); // Remove callbacks from deps to avoid recreating

  if (!uppy) {
    return <div>Loading uploader...</div>;
  }

  return (
    <div className="w-full">
      <Dashboard
        uppy={uppy}
        proudlyDisplayPoweredByUppy={false}
        showSelectedFiles={true}
        showRemoveButtonAfterComplete={false}
        hideUploadButton={false}
        hideProgressAfterFinish={true}
        note="Files up to 10MB"
        height={350}
      />
    </div>
  );
}