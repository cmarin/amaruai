import type { AssetStatus } from '@/utils/batch-flow-service';
import type { UploadedFile as BaseUploadedFile } from '@/utils/upload-service';

export interface UploadedFile {
  name: string;
  url?: string;
}

export interface FileStatus extends AssetStatus {}

export interface BatchFlowUploadedFile extends BaseUploadedFile {
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
