import type { AssetStatus } from '@/utils/batch-flow-service';
import type { UploadedFile as BaseUploadedFile } from '@/utils/upload-service';
import type { PromptTemplate } from '@/utils/prompt-template-service';
import type { ChatModel } from '@/utils/chat-model-service';

// Batch flow specific interfaces
export interface FileStatus extends AssetStatus {
  status: "pending" | "processing" | "completed" | "max_attempts_exceeded" | "failed";
  token_count: number;
  file_name: string;
  progress?: number;
  error?: string;
  content?: string;
}

export interface BatchFlowFile extends BaseUploadedFile {
  file_name: string;
  status: {
    id: string;
    status: string;
    token_count: number;
    file_name: string;
    model?: {
      id: number;
      name: string;
    };
    persona?: {
      id: number;
      role: string;
    };
    template?: {
      id: number;
      name: string;
    };
  };
}

export interface BatchFlowStep {
  prompt_template_id: string;
  chat_model_id: string;
  persona_id: string;
}

export interface PromptTemplateOption extends Pick<PromptTemplate, 'id' | 'title' | 'prompt'> {}

export interface ChatModelOption extends Pick<ChatModel, 'id' | 'name' | 'description'> {}

export interface PersonaOption {
  id: string;
  role: string;
}