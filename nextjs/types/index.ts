import type { AssetStatus } from '@/utils/batch-flow-service';
import type { UploadedFile as BaseUploadedFile } from '@/utils/upload-service';

// Base interface for uploaded files
export interface UploadedFile extends BaseUploadedFile {
  name: string;
  url?: string;
}

// Batch flow specific interfaces
export interface FileStatus extends AssetStatus {}

export interface BatchFlowUploadedFile extends UploadedFile {
  status: FileStatus;
}

export interface BatchFlowStep {
  prompt_template_id: string;
  chat_model_id: string;
  persona_id: string;
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
