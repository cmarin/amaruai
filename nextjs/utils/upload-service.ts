import Uppy from '@uppy/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { dlog } from '@/utils/debug';

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
            autoProceed: true,  // Auto-upload when files are selected
            restrictions: {
                maxFileSize: config.restrictions?.maxFileSize || 10 * 1024 * 1024,
                maxNumberOfFiles: config.restrictions?.maxNumberOfFiles ?? config.maxFiles ?? 10,
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
                // Mark file as "uploading" for Dashboard/progress state
                uppy.setFileState(file.id, {
                    progress: {
                        uploadStarted: Date.now(),
                        bytesUploaded: 0,
                        bytesTotal: file.size ?? 0,
                    },
                });

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
                const bucket = config.storageBucket ?? process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? 'amaruai-dev';

                const { data: uploadData, error: uploadError } = await supabase.storage
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
                    console.error('Error uploading file:', uploadError);
                    uppy.setFileState(file.id, { error: uploadError.message });
                    const errorObj = {
                        name: uploadError.name || 'UploadError',
                        message: uploadError.message,
                        details: uploadError.stack
                    };
                    uppy.emit('upload-error', file, errorObj);
                    return;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(filePath);

                // Use the storage ID from the upload response, fallback to fileUuid if not available
                // The Supabase storage response might have 'id', 'Id', or other field names
                const storageId = uploadData?.id || uploadData?.Id || fileUuid;
                dlog('Upload data:', uploadData);
                dlog('Using storage ID:', storageId);

                const uploadedFile: UploadedFile = {
                    id: storageId,
                    name: file.name || '',
                    type: file.type || 'application/octet-stream',
                    size: file.size || 0,
                    uploadURL: publicUrl
                };

                if (onFileUploaded) {
                    dlog('Calling onFileUploaded callback with:', uploadedFile);
                    onFileUploaded(uploadedFile);
                } else {
                    dlog('No onFileUploaded callback provided');
                }

                // Reflect success in Uppy UI and emit lifecycle events
                uppy.setFileState(file.id, {
                    progress: {
                        uploadStarted: Date.now(),
                        uploadComplete: true,
                        bytesUploaded: file.size ?? 0,
                        bytesTotal: file.size ?? 0,
                    },
                });
                uppy.emit('upload-success', file, { status: 200, uploadURL: publicUrl });

                // If all files in the current selection are done (success/failed), emit 'complete'
                const files = uppy.getFiles();
                const successful = files.filter(f => f.progress?.uploadComplete);
                const failed = files.filter(f => Boolean((f as any).error));
                if (successful.length + failed.length === files.length) {
                    uppy.emit('complete', { successful, failed });
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                // Surface to listeners instead of throwing from an event handler
                const errorMessage = error instanceof Error ? error.message : 'Upload failed';
                uppy.setFileState(file.id, { error: errorMessage });
                try {
                    const errorObj = {
                        name: error instanceof Error ? error.name : 'UploadError',
                        message: errorMessage,
                        details: error instanceof Error ? error.stack : undefined
                    };
                    uppy.emit('upload-error', file, errorObj);
                } catch {
                    // no-op: ensure we don't crash the app from an event context
                }
                return;
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