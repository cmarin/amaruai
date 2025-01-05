import type { UploadedFile as BaseUploadedFile } from '@/utils/upload-service';
import type { AssetStatus } from '@/utils/batch-flow-service';

export interface FileStatus extends AssetStatus {}

export interface UploadedFile extends BaseUploadedFile {
  status: FileStatus;
}

export interface PromptTemplateOption {
  id: string;
  title: string;
}

export interface ChatModelOption {
  id: string;
  name: string;
}

export interface PersonaOption {
  id: string;
  role: string;
}
