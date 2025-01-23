'use client';

import { useEffect, useState } from 'react';
import { Dashboard } from '@uppy/react';
import Uppy from '@uppy/core';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { UploadService, UploadedFile } from '@/utils/upload-service';
import { useToast } from "@/hooks/use-toast"
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';

interface AssetUploaderProps {
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: Error) => void;
  knowledgeBaseId?: string;
}

export function AssetUploader({ onUploadComplete, onUploadError, knowledgeBaseId }: AssetUploaderProps) {
  const [uppy, setUppy] = useState<ReturnType<typeof UploadService.createUppy> | null>(null);
  const supabase = useSupabase();
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    const uppyInstance = UploadService.createUppy(
      'asset-uploader',
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
        setUploadedFiles(prev => [...prev, file]);
        toast({
          title: "File uploaded",
          description: `Successfully uploaded ${file.name}`,
        });
      },
      (result) => {
        if (onUploadComplete) {
          onUploadComplete(uploadedFiles);
        }
      },
      supabase,
      knowledgeBaseId
    );

    setUppy(uppyInstance);

    return () => {
      if (uppyInstance) {
        uppyInstance.destroy();
      }
    };
  }, [supabase, onUploadComplete, toast, uploadedFiles, knowledgeBaseId]);

  if (!uppy) {
    return <div>Loading uploader...</div>;
  }

  return (
    <div className="w-full">
      <Dashboard
        uppy={uppy}
        proudlyDisplayPoweredByUppy={false}
        showSelectedFiles={true}
        showRemoveButtonAfterComplete={true}
        hideUploadButton={false}
        note="Files up to 10MB"
        height={350}
      />
    </div>
  );
}