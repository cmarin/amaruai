import type { AssetStatus } from '@/utils/batch-flow-service';
import type { UploadedFile as BaseUploadedFile } from '@/utils/upload-service';

// Batch flow specific interfaces
export interface FileStatus extends AssetStatus {
  status: "pending" | "processing" | "completed" | "max_attempts_exceeded" | "failed";
  token_count: number;
  file_name: string;
  progress?: number;
  error?: string;
}

export interface BatchFlowFile extends BaseUploadedFile {
  file_name: string;
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