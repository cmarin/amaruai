import Uppy from '@uppy/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export interface UploadedFile {
    id: string;
    name: string;
    type: string;
    size: number;
    uploadURL: string;
}

interface UploadConfig {
    maxFiles?: number;
    storageFolder?: string;
    storageBucket?: string;
    restrictions?: {
        maxFileSize?: number;
        maxNumberOfFiles?: number;
        allowedFileTypes?: string[];
    };
}

export class UploadService {
    static createUppy(
        id: string,
        config: UploadConfig,
        onFileUploaded?: (file: UploadedFile) => void,
        onComplete?: (result: any) => void,
        supabase?: SupabaseClient,
        knowledgeBaseId?: string
    ) {
        if (!supabase) {
            throw new Error('Supabase client is required');
        }

        const uppy = new Uppy({
            id,
            autoProceed: true,  // Changed to true to auto-upload files
            restrictions: {
                maxFileSize: config.restrictions?.maxFileSize || 10 * 1024 * 1024,
                maxNumberOfFiles: config.maxFiles || 10,
                allowedFileTypes: config.restrictions?.allowedFileTypes || [
                    'image/*',
                    'application/pdf',
                    '.doc', '.docx',
                    '.ppt', '.pptx',
                    '.txt',
                    '.md', '.markdown',
                    'text/plain',
                    'text/markdown',
                    'audio/*',
                    'video/*'
                ]
            }
        });

        uppy.on('file-added', async (file) => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) {
                    throw new Error('User must be authenticated to upload files');
                }

                if (!file.name || file.size === null || file.size === undefined) {
                    throw new Error('File name or size is undefined');
                }

                const fileUuid = uuidv4();
                const filePath = knowledgeBaseId 
                    ? `knowledge-bases/${knowledgeBaseId}/${fileUuid}/${file.name}`
                    : `${config.storageFolder}/${session.user.id}/${fileUuid}/${file.name}`;

                const mimeType = file.type || 'application/octet-stream';
                const bucket = config.storageBucket || 'amaruai-dev';

                const { error: uploadError } = await supabase.storage
                    .from(bucket)
                    .upload(filePath, file.data, {
                        contentType: mimeType,
                        duplex: 'half',
                        cacheControl: '3600',
                        upsert: true,
                        metadata: {
                            mime_type: mimeType,
                            size: file.size.toString(),
                            uploaded_at: new Date().toISOString(),
                            original_name: file.name,
                            user_id: session.user.id,
                            ...(knowledgeBaseId ? { knowledge_base_id: knowledgeBaseId } : {})
                        }
                    });

                if (uploadError) {
                    throw uploadError;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(filePath);

                const uploadedFile: UploadedFile = {
                    id: fileUuid,
                    name: file.name || '',
                    type: file.type || 'application/octet-stream',
                    size: file.size || 0,
                    uploadURL: publicUrl
                };

                if (onFileUploaded) {
                    onFileUploaded(uploadedFile);
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                throw error;
            }
        });

        uppy.on('complete', (result) => {
            // Disable toast notification here
            if (onComplete) {
                onComplete(result);
            }
        });

        return uppy;
    }
}