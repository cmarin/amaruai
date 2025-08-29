import { KnowledgeBase } from '@/utils/knowledge-base-service';
import { Asset } from '@/types/knowledge-base';

export interface KnowledgeBaseSelection {
  knowledge_base_id: string;
  selection_type: 'single' | 'multiple';
  max_selections?: number;
  required: boolean;
  label: string;
}

export interface AssetSelectionConfig {
  knowledge_base_selections: KnowledgeBaseSelection[];
}

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
  search?: boolean;
  allow_file_upload?: boolean;
  allow_asset_selection?: boolean;
  asset_selection_config?: AssetSelectionConfig;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
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

export interface WorkflowCreate {
  name: string;
  description?: string;
  process_type: string;
  manager_chat_model_id?: string;
  manager_persona_id?: string;
  max_iterations?: number;
  search?: boolean;
  allow_file_upload?: boolean;
  allow_asset_selection?: boolean;
  asset_selection_config?: AssetSelectionConfig;
  asset_ids?: string[];
  knowledge_base_ids?: string[];
}

export interface WorkflowUpdate extends WorkflowCreate {
  id?: string;
}

export interface WorkflowExecuteInput {
  message?: string;
  file_ids?: string[];
  asset_ids?: string[];
  knowledge_base_ids?: string[];
  individual_asset_selections?: Record<string, string[]>;
} 