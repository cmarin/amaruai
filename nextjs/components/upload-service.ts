import Uppy from '@uppy/core';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface UploadedFile {
    name: string;
    size: number;
    url: string;
}

export interface UploadServiceConfig {
    maxFileSize?: number;  // in bytes
    maxFiles?: number;
    allowedFileTypes?: string[];
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
        onComplete?: (result: any) => void
    ): Uppy {
        const finalConfig = { ...this.defaultConfig, ...config };
        const supabase = createClientComponentClient();

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
                if (!file.name) {
                    throw new Error('File name is undefined');
                }
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${finalConfig.storageFolder}/${fileName}`;

                // Upload file to Supabase storage
                const { data, error } = await supabase.storage
                    .from(finalConfig.storageBucket!)
                    .upload(filePath, file.data);

                if (error) throw error;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(finalConfig.storageBucket!)
                    .getPublicUrl(filePath);

                if (onFileUploaded) {
                    onFileUploaded({
                        name: file.name,
                        size: file.size || 0,  // Provide a default of 0 if size is null
                        url: publicUrl
                    });
                }

                console.log('File uploaded:', publicUrl);
            } catch (error) {
                console.error('Error uploading file:', error);
                throw error;
            }
        });

        if (onComplete) {
            uppy.on('complete', onComplete);
        }

        return uppy;
    }

    static async uploadFile(
        file: File,
        config: Partial<UploadServiceConfig> = {}
    ): Promise<UploadedFile> {
        const finalConfig = { ...this.defaultConfig, ...config };
        const supabase = createClientComponentClient();

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${finalConfig.storageFolder}/${fileName}`;

        const { data, error } = await supabase.storage
            .from(finalConfig.storageBucket!)
            .upload(filePath, file);

        if (error) throw error;

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
        config: Partial<UploadServiceConfig> = {}
    ): Promise<void> {
        const finalConfig = { ...this.defaultConfig, ...config };
        const supabase = createClientComponentClient();

        const { error } = await supabase.storage
            .from(finalConfig.storageBucket!)
            .remove([filePath]);

        if (error) throw error;
    }
}
