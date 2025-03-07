import { KnowledgeBase } from '@/utils/knowledge-base-service';
import { Asset } from '@/types/knowledge-base';

export interface WorkflowStep {
  id?: string;
  workflow_id?: string;
  prompt_template_id: string;
  chat_model_id: string;
  persona_id: string;
  position: number;
}

export interface Workflow {
  id?: string;
  name: string;
  description: string;
  process_type: 'SEQUENTIAL' | 'HIERARCHICAL';
  steps: WorkflowStep[];
  manager_chat_model_id?: string;
  manager_persona_id?: string;
  max_iterations?: number;
  knowledge_base_ids?: string[];
  asset_ids?: string[];
  assets?: Asset[];
  knowledge_bases?: KnowledgeBase[];
}

export interface WorkflowResult {
  step: string;
  prompt: string;
  response: string;
  chat_model?: {
    id: string;
    name: string;
    model: string;
  };
  persona?: {
    id: string;
    role: string;
    goal: string;
  };
}

export interface WorkflowStreamMessage {
  step?: string | number;
  prompt?: string;
  response?: string;
  type: 'step' | 'completion' | 'error' | 'status';
  error?: string;
  content?: string;
  message?: string;
  chat_model?: {
    id: string;
    name: string;
    model: string;
  };
  persona?: {
    id: string;
    role: string;
    goal: string;
  };
} 