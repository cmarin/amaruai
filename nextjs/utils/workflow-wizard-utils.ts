import { Workflow } from '@/types/workflow';
import { PromptTemplate } from '@/utils/prompt-template-service';
import { WizardStepConfig, WizardStepId, WIZARD_STEPS } from '@/types/workflow-wizard';

/**
 * Determines which steps should be shown in the workflow wizard
 * based on the workflow configuration
 */
export function determineWizardSteps(
  workflow: Workflow,
  firstPromptTemplate?: PromptTemplate
): WizardStepConfig[] {
  const steps: WizardStepConfig[] = [];

  // File upload step
  if (workflow.allow_file_upload) {
    steps.push({
      id: WIZARD_STEPS.FILE_UPLOAD,
      label: 'Upload Files',
      description: 'Upload files to include in your workflow',
      required: false
    });
  }

  // Asset selection step
  if (workflow.allow_asset_selection) {
    steps.push({
      id: WIZARD_STEPS.ASSET_SELECTION,
      label: 'Select Resources',
      description: 'Choose assets and knowledge bases for your workflow',
      required: false
    });
  }

  // Individual asset selection step
  if (workflow.asset_selection_config?.knowledge_base_selections?.length) {
    steps.push({
      id: WIZARD_STEPS.INDIVIDUAL_ASSET_SELECTION,
      label: 'Select Specific Assets',
      description: 'Choose individual assets from specific knowledge bases',
      required: workflow.asset_selection_config.knowledge_base_selections.some(s => s.required)
    });
  }

  // Complex prompt step - only if first template is complex
  if (firstPromptTemplate?.is_complex) {
    steps.push({
      id: WIZARD_STEPS.COMPLEX_PROMPT,
      label: 'Configure Prompt',
      description: 'Fill out the form to customize your prompt',
      required: true
    });
  }

  // Always add review step if we have any other steps
  if (steps.length > 0) {
    steps.push({
      id: WIZARD_STEPS.REVIEW,
      label: 'Review & Execute',
      description: 'Review your selections and start the workflow',
      required: true
    });
  }

  return steps;
}

/**
 * Checks if the workflow wizard should be shown at all
 */
export function shouldShowWizard(
  workflow: Workflow,
  firstPromptTemplate?: PromptTemplate
): boolean {
  return (
    workflow.allow_file_upload || 
    workflow.allow_asset_selection ||
    (workflow.asset_selection_config?.knowledge_base_selections?.length ?? 0) > 0 ||
    firstPromptTemplate?.is_complex === true
  );
}

/**
 * Validates if a step can be completed based on the current wizard state
 */
export function canCompleteStep(
  stepId: WizardStepId,
  workflow: Workflow,
  wizardState: {
    uploadedFiles: any[];
    selectedAssets: string[];
    selectedKnowledgeBases: string[];
    individualAssetSelections?: Record<string, string[]>;
    complexPromptData?: string;
  }
): boolean {
  switch (stepId) {
    case WIZARD_STEPS.FILE_UPLOAD:
      // File upload is optional - can always proceed
      return true;

    case WIZARD_STEPS.ASSET_SELECTION:
      // Asset selection is optional - can always proceed
      return true;

    case WIZARD_STEPS.INDIVIDUAL_ASSET_SELECTION: {
      // Check if all required individual asset selections are made
      if (!workflow.asset_selection_config?.knowledge_base_selections?.length) {
        return true;
      }
      
      const selections = wizardState.individualAssetSelections || {};
      return workflow.asset_selection_config.knowledge_base_selections.every(config => {
        const kbSelections = selections[config.knowledge_base_id] || [];
        
        // Check if required selection is made
        if (config.required && kbSelections.length === 0) {
          return false;
        }
        
        // Check single selection has at most 1 item
        if (config.selection_type === 'single' && kbSelections.length > 1) {
          return false;
        }
        
        // Check if selection doesn't exceed max limit for multiple
        if (config.selection_type === 'multiple' && config.max_selections) {
          if (kbSelections.length > config.max_selections) {
            return false;
          }
        }
        
        return true;
      });
    }

    case WIZARD_STEPS.COMPLEX_PROMPT:
      // Complex prompt requires data to be provided
      return Boolean(wizardState.complexPromptData);

    case WIZARD_STEPS.REVIEW:
      // Review step can always be completed if we reached it
      return true;

    default:
      return false;
  }
}

/**
 * Gets the next step ID in the sequence
 */
export function getNextStepId(
  currentStepId: WizardStepId,
  steps: WizardStepConfig[]
): WizardStepId | null {
  const currentIndex = steps.findIndex(step => step.id === currentStepId);
  if (currentIndex >= 0 && currentIndex < steps.length - 1) {
    return steps[currentIndex + 1].id as WizardStepId;
  }
  return null;
}

/**
 * Gets the previous step ID in the sequence
 */
export function getPreviousStepId(
  currentStepId: WizardStepId,
  steps: WizardStepConfig[]
): WizardStepId | null {
  const currentIndex = steps.findIndex(step => step.id === currentStepId);
  if (currentIndex > 0) {
    return steps[currentIndex - 1].id as WizardStepId;
  }
  return null;
}

/**
 * Checks if the current step is the first step
 */
export function isFirstStep(currentStepId: WizardStepId, steps: WizardStepConfig[]): boolean {
  return steps.length > 0 && steps[0].id === currentStepId;
}

/**
 * Checks if the current step is the last step
 */
export function isLastStep(currentStepId: WizardStepId, steps: WizardStepConfig[]): boolean {
  return steps.length > 0 && steps[steps.length - 1].id === currentStepId;
}

/**
 * Gets the step configuration by ID
 */
export function getStepConfig(
  stepId: WizardStepId,
  steps: WizardStepConfig[]
): WizardStepConfig | undefined {
  return steps.find(step => step.id === stepId);
}

/**
 * Calculates the current progress percentage
 */
export function calculateProgress(
  currentStepId: WizardStepId,
  steps: WizardStepConfig[]
): number {
  const currentIndex = steps.findIndex(step => step.id === currentStepId);
  if (currentIndex < 0) return 0;
  return Math.round(((currentIndex + 1) / steps.length) * 100);
}

/**
 * Validates wizard state before execution
 */
export function validateWizardForExecution(
  workflow: Workflow,
  wizardState: {
    uploadedFiles: any[];
    selectedAssets: string[];
    selectedKnowledgeBases: string[];
    individualAssetSelections?: Record<string, string[]>;
    complexPromptData?: string;
  },
  firstPromptTemplate?: PromptTemplate
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // If complex prompt is required, ensure it's provided
  if (firstPromptTemplate?.is_complex && !wizardState.complexPromptData) {
    errors.push('Complex prompt configuration is required');
  }

  // Validate individual asset selections
  if (workflow.asset_selection_config?.knowledge_base_selections?.length) {
    const selections = wizardState.individualAssetSelections || {};
    
    workflow.asset_selection_config.knowledge_base_selections.forEach(config => {
      const kbSelections = selections[config.knowledge_base_id] || [];
      
      if (config.required && kbSelections.length === 0) {
        errors.push(`${config.label} selection is required`);
      }
      
      if (config.selection_type === 'single' && kbSelections.length > 1) {
        errors.push(`${config.label} allows only a single selection`);
      }
      
      if (config.selection_type === 'multiple' && config.max_selections && kbSelections.length > config.max_selections) {
        errors.push(`${config.label} selection exceeds maximum limit of ${config.max_selections}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}