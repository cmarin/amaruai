import Uppy from '@uppy/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export interface UploadedFile {
    name: string;
    size: number;
    url?: string;
}

export interface UploadServiceConfig {
    maxFileSize: number;
    maxFiles: number;
    allowedFileTypes: string[];
    storageFolder?: string;
    storageBucket?: string;
}

export class UploadService {
    private static defaultConfig: UploadServiceConfig = {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        allowedFileTypes: ['image/*', 'application/pdf', '.doc', '.docx'],
        storageFolder: 'uploads',
        storageBucket: 'amaruai-dev'
    };

    static createUppy(
        id: string,
        config: Partial<UploadServiceConfig> = {},
        onFileUploaded?: (file: UploadedFile) => void,
        onComplete?: (result: any) => void,
        supabase?: SupabaseClient
    ): Uppy {
        const finalConfig = { ...this.defaultConfig, ...config };
        
        if (!supabase) {
            throw new Error('Supabase client is required');
        }

        const uppy = new Uppy({
            id,
            autoProceed: false,
            restrictions: {
                maxFileSize: finalConfig.maxFileSize,
                maxNumberOfFiles: finalConfig.maxFiles,
                allowedFileTypes: finalConfig.allowedFileTypes
            }
        });

        uppy.on('file-added', async (file) => {
            try {
                if (!file.name || file.size === null) {
                    throw new Error('File name or size is undefined');
                }

                // Get the current session
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) {
                    throw new Error('User must be authenticated to upload files');
                }

                const fileExt = file.name.split('.').pop();
                const fileUuid = uuidv4();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${finalConfig.storageFolder}/${session.user.id}/${fileUuid}/${fileName}`;

                console.log('Uploading file:', {
                    path: filePath,
                    type: file.type,
                    size: file.size
                });

                const mimeType = file.type || 'application/octet-stream';

                console.log('Uploading file:', {
                    path: filePath,
                    type: mimeType,
                    size: file.size
                });

                // Upload file to Supabase storage
                const { data, error } = await supabase.storage
                    .from(finalConfig.storageBucket!)
                    .upload(filePath, file.data, {
                        contentType: mimeType,
                        duplex: 'half',
                        cacheControl: '3600'
                    });

                if (error) throw error;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(finalConfig.storageBucket!)
                    .getPublicUrl(filePath);

                const uploadedFile: UploadedFile = {
                    name: file.name || '',
                    size: file.size || 0,
                    url: publicUrl
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

    static async uploadFile(
        file: File,
        config: Partial<UploadServiceConfig> = {},
        supabase?: SupabaseClient
    ): Promise<UploadedFile> {
        const finalConfig = { ...this.defaultConfig, ...config };
        
        if (!supabase) {
            throw new Error('Supabase client is required');
        }

        if (!file.name || !file.size) {
            throw new Error('File name or size is undefined');
        }

        // Get the current session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
            throw new Error('User must be authenticated to upload files');
        }

        const fileExt = file.name.split('.').pop();
        const fileUuid = uuidv4();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${finalConfig.storageFolder}/${session.user.id}/${fileUuid}/${fileName}`;

        console.log('Uploading file:', {
            path: filePath,
            type: file.type,
            size: file.size
        });

        const mimeType = file.type || 'application/octet-stream';

        console.log('Uploading file:', {
            path: filePath,
            type: mimeType,
            size: file.size
        });

        // Upload file to Supabase storage
        const { data, error } = await supabase.storage
            .from(finalConfig.storageBucket!)
            .upload(filePath, file, {
                contentType: mimeType,
                duplex: 'half',
                cacheControl: '3600'
            });

        if (error) {
            console.error('Error uploading file:', error);
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(finalConfig.storageBucket!)
            .getPublicUrl(filePath);

        return {
            name: file.name,
            size: file.size,
            url: publicUrl
        };
    }

    static async deleteFile(
        filePath: string,
        config: Partial<UploadServiceConfig> = {},
        supabase?: SupabaseClient
    ): Promise<void> {
        const finalConfig = { ...this.defaultConfig, ...config };
        
        if (!supabase) {
            throw new Error('Supabase client is required');
        }

        const { error } = await supabase.storage
            .from(finalConfig.storageBucket!)
            .remove([filePath]);

        if (error) throw error;
    }
}
