import { UploadedFile } from '@/utils/upload-service';
import { Workflow } from '@/types/workflow';
import { PromptTemplate } from '@/utils/prompt-template-service';

export interface WizardStepConfig {
  id: string;
  label: string;
  description?: string;
  required: boolean;
}

export interface WorkflowWizardState {
  // File upload data
  uploadedFiles: UploadedFile[];
  
  // Asset and knowledge base selection
  selectedAssets: string[];
  selectedKnowledgeBases: string[];
  
  // Individual asset selections by knowledge base ID
  individualAssetSelections: Record<string, string[]>;
  
  // Complex prompt data
  complexPromptData?: string;
  
  // Current step tracking
  currentStepId: string;
  completedSteps: Set<string>;
  
  // Workflow execution data
  isExecuting: boolean;
  executionResults?: any;
}

export interface WorkflowWizardConfig {
  steps: WizardStepConfig[];
  workflow: Workflow;
  firstPromptTemplate?: PromptTemplate;
}

export interface WizardStepProps {
  workflow: Workflow;
  wizardState: WorkflowWizardState;
  onStateChange: (updates: Partial<WorkflowWizardState>) => void;
  onNext: () => void;
  onPrevious: () => void;
  onComplete: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export interface WorkflowExecutionWizardProps {
  workflow: Workflow;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (data: {
    uploadedFiles: UploadedFile[];
    selectedAssets: string[];
    selectedKnowledgeBases: string[];
    individualAssetSelections?: Record<string, string[]>;
    complexPromptData?: string;
  }) => void;
}

// Step IDs for the wizard
export const WIZARD_STEPS = {
  FILE_UPLOAD: 'file_upload',
  ASSET_SELECTION: 'asset_selection',
  INDIVIDUAL_ASSET_SELECTION: 'individual_asset_selection',
  COMPLEX_PROMPT: 'complex_prompt',
  REVIEW: 'review'
} as const;

export type WizardStepId = typeof WIZARD_STEPS[keyof typeof WIZARD_STEPS];