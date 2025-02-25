import Uppy from '@uppy/core';
import { UploadService, UploadedFile } from './upload-service';
import { SupabaseClient } from '@supabase/supabase-js';
import { MutableRefObject } from 'react';

/**
 * Configuration options for chat file uploads
 */
export interface ChatUploaderConfig {
  maxFiles?: number;
  storageFolder?: string;
  storageBucket?: string;
}

/**
 * Default configuration for chat uploads
 */
const DEFAULT_CONFIG: ChatUploaderConfig = {
  maxFiles: 1,
  storageFolder: 'chats',
  storageBucket: 'amaruai-dev'
};

/**
 * Initializes an Uppy instance for chat file uploads
 * 
 * @param uppyRef - React ref to store the Uppy instance
 * @param onFileSuccess - Callback when a file is successfully uploaded
 * @param onComplete - Callback when all uploads are complete
 * @param supabase - Supabase client instance
 * @param config - Upload configuration options
 * @returns A function to clean up the Uppy instance
 */
export const initializeChatUploader = (
  uppyRef: MutableRefObject<Uppy | null>,
  onFileSuccess: (file: UploadedFile) => void,
  onComplete: () => void,
  supabase: SupabaseClient,
  config: ChatUploaderConfig = DEFAULT_CONFIG
): (() => void) => {
  if (!uppyRef.current) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    
    const uppyInstance = UploadService.createUppy(
      'chat-uploader',
      {
        maxFiles: mergedConfig.maxFiles,
        storageFolder: mergedConfig.storageFolder,
        storageBucket: mergedConfig.storageBucket
      },
      (file) => {
        onFileSuccess({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          uploadURL: file.uploadURL
        });
      },
      onComplete,
      supabase
    );
    
    uppyRef.current = uppyInstance;
  }

  // Return cleanup function
  return () => {
    if (uppyRef.current) {
      uppyRef.current.cancelAll();
    }
  };
};

/**
 * Handles successful file uploads
 * 
 * @param result - The upload result from Uppy
 * @param setUploadedFiles - State setter for uploaded files
 */
export const handleFileUpload = (
  result: any,
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
): void => {
  if (result.successful && result.successful.length > 0) {
    const file = result.successful[0];
    const uploadedFile: UploadedFile = {
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadURL: file.uploadURL
    };
    setUploadedFiles(prev => [...prev, uploadedFile]);
  }
};

/**
 * Closes the upload modal and cancels any ongoing uploads
 * 
 * @param uppyRef - React ref containing the Uppy instance
 * @param setShowUploadModal - State setter for the upload modal visibility
 */
export const closeUploadModal = (
  uppyRef: MutableRefObject<Uppy | null>,
  setShowUploadModal: React.Dispatch<React.SetStateAction<boolean>>
): void => {
  setShowUploadModal(false);
  if (uppyRef.current) {
    uppyRef.current.cancelAll();
  }
};

/**
 * Removes a file from the uploaded files list
 * 
 * @param file - The file to remove
 * @param setUploadedFiles - State setter for uploaded files
 */
export const removeUploadedFile = (
  file: UploadedFile,
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
): void => {
  setUploadedFiles(prev => prev.filter(f => f.name !== file.name));
}; 