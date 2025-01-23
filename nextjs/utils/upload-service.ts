import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import XHR from '@uppy/xhr-upload';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadURL: string;
}

interface UppyOptions {
  maxFiles: number;
  storageFolder: string;
  storageBucket?: string;
}

export class UploadService {
  static createUppy(
    id: string,
    options: UppyOptions,
    onFileUpload: (file: UploadedFile) => void,
    onComplete: (result: any) => void,
    supabase: SupabaseClient,
    knowledgeBaseId?: string
  ) {
    const uppy = new Uppy({
      id,
      autoProceed: false,
      allowMultipleUploadBatches: true,
      restrictions: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxNumberOfFiles: options.maxFiles,
        allowedFileTypes: [
          'image/*',
          'application/pdf',
          '.doc', '.docx',
          '.ppt', '.pptx',
          '.txt',
          '.md', '.markdown',
          'text/plain',
          'text/markdown',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint',
          'audio/wav',
          'audio/mpeg',
          'audio/flac',
          'video/mp4',
          'video/quicktime',
          '.wav', '.mp3', '.flac',
          '.mp4', '.mov'
        ]
      }
    });

    uppy.on('file-added', async (file) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          throw new Error('User must be authenticated to upload files');
        }

        const fileUuid = uuidv4();
        const filePath = knowledgeBaseId 
          ? `knowledge-bases/${knowledgeBaseId}/${fileUuid}/${file.name}`
          : `${options.storageFolder}/${fileUuid}/${file.name}`;

        const metadata = knowledgeBaseId ? { knowledge_base_id: knowledgeBaseId } : {};
        const bucket = options.storageBucket || 'amaruai-dev';

        if (!file.data) {
          throw new Error('File data is missing');
        }

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file.data, {
            metadata
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        const uploadedFile: UploadedFile = {
          id: fileUuid,
          name: file.name || 'Untitled',
          type: file.type || 'application/octet-stream',
          size: file.size || 0,
          uploadURL: publicUrl
        };

        onFileUpload(uploadedFile);
      } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
      }
    });

    uppy.on('complete', (result) => {
      onComplete(result);
    });

    return uppy;
  }
}
