'use client';

import { useEffect, useState, useRef } from 'react';
import { Dashboard } from '@uppy/react';
import Uppy from '@uppy/core';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { UploadService, UploadedFile } from '@/utils/upload-service';
import { useToast } from "@/hooks/use-toast"
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';

interface AssetUploaderFixedProps {
  onFileUploaded?: (file: UploadedFile) => void;
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: Error) => void;
  knowledgeBaseId?: string;
}

export function AssetUploaderFixed({ 
  onFileUploaded, 
  onUploadComplete, 
  onUploadError, 
  knowledgeBaseId 
}: AssetUploaderFixedProps) {
  const [uppy, setUppy] = useState<ReturnType<typeof UploadService.createUppy> | null>(null);
  const supabase = useSupabase();
  const { toast } = useToast();
  const uploadedFilesRef = useRef<UploadedFile[]>([]);

  useEffect(() => {
    // Reset uploaded files when component mounts
    uploadedFilesRef.current = [];

    const uppyInstance = UploadService.createUppy(
      `asset-uploader-${Date.now()}`, // Unique ID to avoid conflicts
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

    setUppy(uppyInstance);

    return () => {
      if (uppyInstance) {
        uppyInstance.destroy();
      }
    };
  }, [supabase, knowledgeBaseId]); // Remove onUploadComplete and onFileUploaded from deps to avoid recreating

  // Call the callbacks with the current refs to avoid stale closures
  useEffect(() => {
    if (uppy && onFileUploaded) {
      const handler = (file: UploadedFile) => {
        onFileUploaded(file);
      };
      // Store reference to handler if needed
    }
  }, [uppy, onFileUploaded]);

  useEffect(() => {
    if (uppy && onUploadComplete) {
      const handler = (files: UploadedFile[]) => {
        onUploadComplete(files);
      };
      // Store reference to handler if needed
    }
  }, [uppy, onUploadComplete]);

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