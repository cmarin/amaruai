import type { AssetStatus } from '@/utils/batch-flow-service';

export interface UploadedFile {
  name: string;
  url?: string;
}

export interface FileStatus extends UploadedFile {
  status: AssetStatus;
  intervalId?: NodeJS.Timeout;
}

export interface BatchFlowStep {
  prompt_template_id: string;
  chat_model_id: string;
  persona_id: string;
}
