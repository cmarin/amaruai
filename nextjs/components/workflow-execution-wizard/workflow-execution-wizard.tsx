'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { WizardProgress } from './wizard-progress';
import { FileUploadStep } from './file-upload-step';
import { AssetSelectionStep } from './asset-selection-step';
import { ComplexPromptStep } from './complex-prompt-step';
import { ReviewStep } from './review-step';
import { 
  WorkflowExecutionWizardProps, 
  WorkflowWizardState, 
  WizardStepConfig,
  WizardStepId,
  WIZARD_STEPS 
} from '@/types/workflow-wizard';
import { 
  determineWizardSteps, 
  getNextStepId, 
  getPreviousStepId,
  isFirstStep,
  isLastStep,
  canCompleteStep
} from '@/utils/workflow-wizard-utils';
import { fetchPromptTemplate, PromptTemplate } from '@/utils/prompt-template-service';
import { useSession } from '@/app/utils/session/session';
import { derror } from '@/utils/debug';

export function WorkflowExecutionWizard({
  workflow,
  isOpen,
  onClose,
  onExecute
}: WorkflowExecutionWizardProps) {
  const { getApiHeaders } = useSession();
  
  // Wizard configuration and state
  const [steps, setSteps] = useState<WizardStepConfig[]>([]);
  const [firstPromptTemplate, setFirstPromptTemplate] = useState<PromptTemplate | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  
  // Wizard state
  const [wizardState, setWizardState] = useState<WorkflowWizardState>({
    uploadedFiles: [],
    selectedAssets: [],
    selectedKnowledgeBases: [],
    complexPromptData: undefined,
    currentStepId: WIZARD_STEPS.FILE_UPLOAD, // Will be updated after steps are determined
    completedSteps: new Set(),
    isExecuting: false
  });

  // Initialize wizard when it opens
  useEffect(() => {
    if (isOpen && workflow) {
      initializeWizard();
    }
  }, [isOpen, workflow]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setWizardState({
        uploadedFiles: [],
        selectedAssets: [],
        selectedKnowledgeBases: [],
        complexPromptData: undefined,
        currentStepId: WIZARD_STEPS.FILE_UPLOAD,
        completedSteps: new Set(),
        isExecuting: false
      });
    }
  }, [isOpen]);

  const initializeWizard = async () => {
    try {
      setIsLoading(true);
      
      let promptTemplate: PromptTemplate | undefined;
      
      // Fetch first prompt template if needed for complex prompt check
      if (workflow.steps.length > 0) {
        const headers = getApiHeaders();
        if (headers) {
          try {
            promptTemplate = await fetchPromptTemplate(workflow.steps[0].prompt_template_id, headers);
            setFirstPromptTemplate(promptTemplate);
          } catch (error) {
            derror('Error fetching prompt template:', error);
          }
        }
      }

      // Determine which steps to show
      const wizardSteps = determineWizardSteps(workflow, promptTemplate);
      setSteps(wizardSteps);

      // Set initial step
      if (wizardSteps.length > 0) {
        setWizardState(prev => ({
          ...prev,
          currentStepId: wizardSteps[0].id as WizardStepId
        }));
      }
    } catch (error) {
      derror('Error initializing wizard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateWizardState = useCallback((updates: Partial<WorkflowWizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleNext = useCallback(() => {
    const currentStepConfig = steps.find(s => s.id === wizardState.currentStepId);
    if (!currentStepConfig) return;

    // Check if current step can be completed
    const canComplete = canCompleteStep(
      wizardState.currentStepId, 
      workflow, 
      {
        uploadedFiles: wizardState.uploadedFiles,
        selectedAssets: wizardState.selectedAssets,
        selectedKnowledgeBases: wizardState.selectedKnowledgeBases,
        complexPromptData: wizardState.complexPromptData
      }
    );

    if (!canComplete && currentStepConfig.required) {
      return; // Don't proceed if required step is not completed
    }

    // Mark current step as completed and move to next
    const nextStepId = getNextStepId(wizardState.currentStepId, steps);
    if (nextStepId) {
      setWizardState(prev => ({
        ...prev,
        currentStepId: nextStepId,
        completedSteps: new Set([...prev.completedSteps, wizardState.currentStepId])
      }));
    }
  }, [wizardState.currentStepId, wizardState.uploadedFiles, wizardState.selectedAssets, wizardState.selectedKnowledgeBases, wizardState.complexPromptData, workflow, steps]);

  const handlePrevious = useCallback(() => {
    const previousStepId = getPreviousStepId(wizardState.currentStepId, steps);
    if (previousStepId) {
      setWizardState(prev => ({
        ...prev,
        currentStepId: previousStepId
      }));
    }
  }, [wizardState.currentStepId, steps]);

  const handleComplete = useCallback(() => {
    // Execute the workflow with collected data
    onExecute({
      uploadedFiles: wizardState.uploadedFiles,
      selectedAssets: wizardState.selectedAssets,
      selectedKnowledgeBases: wizardState.selectedKnowledgeBases,
      complexPromptData: wizardState.complexPromptData
    });
    
    // Close the wizard
    onClose();
  }, [wizardState, onExecute, onClose]);

  const renderCurrentStep = () => {
    const commonProps = {
      workflow,
      wizardState,
      onStateChange: updateWizardState,
      onNext: handleNext,
      onPrevious: handlePrevious,
      onComplete: handleComplete,
      isFirst: isFirstStep(wizardState.currentStepId, steps),
      isLast: isLastStep(wizardState.currentStepId, steps)
    };

    switch (wizardState.currentStepId) {
      case WIZARD_STEPS.FILE_UPLOAD:
        return <FileUploadStep {...commonProps} />;
      
      case WIZARD_STEPS.ASSET_SELECTION:
        return <AssetSelectionStep {...commonProps} />;
      
      case WIZARD_STEPS.COMPLEX_PROMPT:
        return (
          <ComplexPromptStep 
            {...commonProps} 
            promptTemplate={firstPromptTemplate}
          />
        );
      
      case WIZARD_STEPS.REVIEW:
        return <ReviewStep {...commonProps} />;
      
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500">Unknown step: {wizardState.currentStepId}</p>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3">Loading wizard...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // If no steps are needed, don't show the wizard
  if (steps.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">
              Setup Workflow: {workflow.name}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex-shrink-0 px-2">
          <WizardProgress
            steps={steps}
            currentStepId={wizardState.currentStepId}
            completedSteps={wizardState.completedSteps}
          />
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-2">
          <div className="min-h-[500px]">
            {renderCurrentStep()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}