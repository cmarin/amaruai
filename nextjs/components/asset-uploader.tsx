'use client';

import { useEffect, useState, useRef } from 'react';
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
  const supabase = useSupabase();
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const uppyRef = useRef<any>(null);

  useEffect(() => {
    const uppyInstance = UploadService.createUppy(
      'asset-uploader',
      {
        maxFiles: 10,
        storageFolder: knowledgeBaseId ? `knowledge-bases/${knowledgeBaseId}` : 'assets',
        storageBucket: 'amaruai-dev'
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

    uppyRef.current = uppyInstance;

    return () => {
      if (uppyRef.current) {
        // Clean up Uppy instance
        uppyRef.current.cancelAll();
        uppyRef.current.removeFiles();
        uppyRef.current.close();
      }
    };
  }, [supabase, onUploadComplete, toast, uploadedFiles, knowledgeBaseId]);

  if (!uppyRef.current) {
    return <div>Loading uploader...</div>;
  }

  return (
    <div className="w-full">
      <Dashboard
        uppy={uppyRef.current}
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