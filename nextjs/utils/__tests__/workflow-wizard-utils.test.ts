import {
  determineWizardSteps,
  shouldShowWizard,
  canCompleteStep,
  getNextStepId,
  getPreviousStepId,
  isFirstStep,
  isLastStep,
  calculateProgress,
  validateWizardForExecution,
} from '../workflow-wizard-utils';
import { Workflow } from '@/types/workflow';
import { PromptTemplate } from '@/utils/prompt-template-service';
import { WIZARD_STEPS } from '@/types/workflow-wizard';

describe('workflow-wizard-utils', () => {
  const mockWorkflow: Workflow = {
    id: '1',
    name: 'Test Workflow',
    description: 'Test Description',
    process_type: 'SEQUENTIAL',
    steps: [],
    allow_file_upload: false,
    allow_asset_selection: false,
  };

  const mockComplexPromptTemplate: PromptTemplate = {
    id: '1',
    title: 'Complex Template',
    description: 'Complex Description',
    prompt: '{"prompt": "Test {variable}", "variables": [{"fieldName": "variable", "required": true, "controlType": "text"}]}',
    is_complex: true,
    variables: ['variable'],
    categories: [],
    tags: [],
    is_favorite: false,
  };

  const mockSimplePromptTemplate: PromptTemplate = {
    id: '1',
    title: 'Simple Template',
    description: 'Simple Description',
    prompt: 'Simple prompt',
    is_complex: false,
    variables: [],
    categories: [],
    tags: [],
    is_favorite: false,
  };

  describe('determineWizardSteps', () => {
    it('should return file upload step when allow_file_upload is true', () => {
      const workflow = { ...mockWorkflow, allow_file_upload: true };
      const steps = determineWizardSteps(workflow);
      
      expect(steps).toHaveLength(2); // file upload + review
      expect(steps[0].id).toBe(WIZARD_STEPS.FILE_UPLOAD);
      expect(steps[1].id).toBe(WIZARD_STEPS.REVIEW);
    });

    it('should return asset selection step when allow_asset_selection is true', () => {
      const workflow = { ...mockWorkflow, allow_asset_selection: true };
      const steps = determineWizardSteps(workflow);
      
      expect(steps).toHaveLength(2); // asset selection + review
      expect(steps[0].id).toBe(WIZARD_STEPS.ASSET_SELECTION);
      expect(steps[1].id).toBe(WIZARD_STEPS.REVIEW);
    });

    it('should return complex prompt step when first template is complex', () => {
      const steps = determineWizardSteps(mockWorkflow, mockComplexPromptTemplate);
      
      expect(steps).toHaveLength(2); // complex prompt + review
      expect(steps[0].id).toBe(WIZARD_STEPS.COMPLEX_PROMPT);
      expect(steps[1].id).toBe(WIZARD_STEPS.REVIEW);
    });

    it('should return all steps when all conditions are met', () => {
      const workflow = { ...mockWorkflow, allow_file_upload: true, allow_asset_selection: true };
      const steps = determineWizardSteps(workflow, mockComplexPromptTemplate);
      
      expect(steps).toHaveLength(4); // all steps
      expect(steps.map(s => s.id)).toEqual([
        WIZARD_STEPS.FILE_UPLOAD,
        WIZARD_STEPS.ASSET_SELECTION,
        WIZARD_STEPS.COMPLEX_PROMPT,
        WIZARD_STEPS.REVIEW,
      ]);
    });

    it('should return empty array when no conditions are met', () => {
      const steps = determineWizardSteps(mockWorkflow, mockSimplePromptTemplate);
      expect(steps).toHaveLength(0);
    });
  });

  describe('shouldShowWizard', () => {
    it('should return true when file upload is allowed', () => {
      const workflow = { ...mockWorkflow, allow_file_upload: true };
      expect(shouldShowWizard(workflow, mockSimplePromptTemplate)).toBe(true);
    });

    it('should return true when asset selection is allowed', () => {
      const workflow = { ...mockWorkflow, allow_asset_selection: true };
      expect(shouldShowWizard(workflow, mockSimplePromptTemplate)).toBe(true);
    });

    it('should return true when first template is complex', () => {
      expect(shouldShowWizard(mockWorkflow, mockComplexPromptTemplate)).toBe(true);
    });

    it('should return false when no conditions are met', () => {
      expect(shouldShowWizard(mockWorkflow, mockSimplePromptTemplate)).toBe(false);
    });
  });

  describe('canCompleteStep', () => {
    const mockState = {
      uploadedFiles: [],
      selectedAssets: [],
      selectedKnowledgeBases: [],
    };

    it('should allow completing file upload step (optional)', () => {
      expect(canCompleteStep(WIZARD_STEPS.FILE_UPLOAD, mockWorkflow, mockState)).toBe(true);
    });

    it('should allow completing asset selection step (optional)', () => {
      expect(canCompleteStep(WIZARD_STEPS.ASSET_SELECTION, mockWorkflow, mockState)).toBe(true);
    });

    it('should not allow completing complex prompt step without data', () => {
      expect(canCompleteStep(WIZARD_STEPS.COMPLEX_PROMPT, mockWorkflow, mockState)).toBe(false);
    });

    it('should allow completing complex prompt step with data', () => {
      const stateWithPrompt = { ...mockState, complexPromptData: 'test prompt' };
      expect(canCompleteStep(WIZARD_STEPS.COMPLEX_PROMPT, mockWorkflow, stateWithPrompt)).toBe(true);
    });

    it('should allow completing review step', () => {
      expect(canCompleteStep(WIZARD_STEPS.REVIEW, mockWorkflow, mockState)).toBe(true);
    });
  });

  describe('getNextStepId and getPreviousStepId', () => {
    const steps = [
      { id: WIZARD_STEPS.FILE_UPLOAD, label: 'Upload', required: false },
      { id: WIZARD_STEPS.ASSET_SELECTION, label: 'Assets', required: false },
      { id: WIZARD_STEPS.REVIEW, label: 'Review', required: true },
    ];

    it('should get next step correctly', () => {
      expect(getNextStepId(WIZARD_STEPS.FILE_UPLOAD, steps)).toBe(WIZARD_STEPS.ASSET_SELECTION);
      expect(getNextStepId(WIZARD_STEPS.ASSET_SELECTION, steps)).toBe(WIZARD_STEPS.REVIEW);
      expect(getNextStepId(WIZARD_STEPS.REVIEW, steps)).toBe(null);
    });

    it('should get previous step correctly', () => {
      expect(getPreviousStepId(WIZARD_STEPS.FILE_UPLOAD, steps)).toBe(null);
      expect(getPreviousStepId(WIZARD_STEPS.ASSET_SELECTION, steps)).toBe(WIZARD_STEPS.FILE_UPLOAD);
      expect(getPreviousStepId(WIZARD_STEPS.REVIEW, steps)).toBe(WIZARD_STEPS.ASSET_SELECTION);
    });
  });

  describe('isFirstStep and isLastStep', () => {
    const steps = [
      { id: WIZARD_STEPS.FILE_UPLOAD, label: 'Upload', required: false },
      { id: WIZARD_STEPS.REVIEW, label: 'Review', required: true },
    ];

    it('should identify first step correctly', () => {
      expect(isFirstStep(WIZARD_STEPS.FILE_UPLOAD, steps)).toBe(true);
      expect(isFirstStep(WIZARD_STEPS.REVIEW, steps)).toBe(false);
    });

    it('should identify last step correctly', () => {
      expect(isLastStep(WIZARD_STEPS.FILE_UPLOAD, steps)).toBe(false);
      expect(isLastStep(WIZARD_STEPS.REVIEW, steps)).toBe(true);
    });
  });

  describe('calculateProgress', () => {
    const steps = [
      { id: WIZARD_STEPS.FILE_UPLOAD, label: 'Upload', required: false },
      { id: WIZARD_STEPS.ASSET_SELECTION, label: 'Assets', required: false },
      { id: WIZARD_STEPS.REVIEW, label: 'Review', required: true },
    ];

    it('should calculate progress correctly', () => {
      expect(calculateProgress(WIZARD_STEPS.FILE_UPLOAD, steps)).toBe(33); // 1/3 * 100
      expect(calculateProgress(WIZARD_STEPS.ASSET_SELECTION, steps)).toBe(67); // 2/3 * 100
      expect(calculateProgress(WIZARD_STEPS.REVIEW, steps)).toBe(100); // 3/3 * 100
    });

    it('should return 0 for unknown step', () => {
      expect(calculateProgress('unknown' as any, steps)).toBe(0);
    });
  });

  describe('validateWizardForExecution', () => {
    const mockState = {
      uploadedFiles: [],
      selectedAssets: [],
      selectedKnowledgeBases: [],
    };

    it('should validate successfully when complex prompt is not required', () => {
      const result = validateWizardForExecution(mockWorkflow, mockState, mockSimplePromptTemplate);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when complex prompt is required but missing', () => {
      const result = validateWizardForExecution(mockWorkflow, mockState, mockComplexPromptTemplate);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Complex prompt configuration is required');
    });

    it('should validate successfully when complex prompt is provided', () => {
      const stateWithPrompt = { ...mockState, complexPromptData: 'test prompt' };
      const result = validateWizardForExecution(mockWorkflow, stateWithPrompt, mockComplexPromptTemplate);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});