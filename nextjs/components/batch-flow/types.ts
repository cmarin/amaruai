import type { UploadedFile as BaseUploadedFile } from '@/types';

export interface FileStatus {
  id: string;
  status: 'pending' | 'completed' | 'failed' | 'max_attempts_exceeded';
  token_count: number;
  file_name: string;
}

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
