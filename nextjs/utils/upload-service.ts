import Uppy from '@uppy/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { createAsset } from './asset-service';
import { ApiHeaders } from '@/app/utils/session/session';

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
        knowledgeBaseId?: string,
        headers?: ApiHeaders
    ) {
        if (!supabase) {
            throw new Error('Supabase client is required');
        }

        if (!headers) {
            throw new Error('API headers are required');
        }

        const uppy = new Uppy({
            id,
            autoProceed: false,
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

                // First upload the file to storage
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

                // Create the asset using the API
                const asset = await createAsset({
                    title: file.name,
                    file_name: file.name,
                    description: '',
                    url: publicUrl,
                    managed: true,
                    type: 'file',
                    mime_type: mimeType,
                    file_type: mimeType.split('/')[1] || 'unknown',
                    size: file.size,
                    content: ''
                }, headers);

                const uploadedFile: UploadedFile = {
                    id: asset.id,
                    name: file.name,
                    type: file.type || 'application/octet-stream',
                    size: file.size,
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
            if (onComplete) {
                onComplete(result);
            }
        });

        return uppy;
    }
}
