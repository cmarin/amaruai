import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

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

        uppy.use(Dashboard, {
            inline: false,
            target: 'body',
            showProgressDetails: true,
            proudlyDisplayPoweredByUppy: false,
        });

        uppy.on('file-added', async (file) => {
            try {
                if (!file.name) {
                    throw new Error('File name is undefined');
                }
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${finalConfig.storageFolder}/${fileName}`;

                const { data, error } = await supabase.storage
                    .from(finalConfig.storageBucket!)
                    .upload(filePath, file.data);

                if (error) throw error;

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

        const uploadedFile: UploadedFile = {
            name: file.name || '',
            size: file.size || 0,
            url: publicUrl
        };

        return uploadedFile;
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
