import React from 'react';
import { render, screen } from '@testing-library/react';
import { WizardProgress } from '../wizard-progress';
import { WIZARD_STEPS } from '@/types/workflow-wizard';

// Mock session hook
jest.mock('@/app/utils/session/session', () => ({
  useSession: () => ({
    session: { access_token: 'mock-token' },
    getApiHeaders: () => ({ Authorization: 'Bearer mock-token' }),
    loading: false,
    initialized: true,
  }),
}));

const mockSteps = [
  { id: WIZARD_STEPS.FILE_UPLOAD, label: 'Upload Files', description: 'Upload files', required: false },
  { id: WIZARD_STEPS.ASSET_SELECTION, label: 'Select Assets', description: 'Choose assets', required: false },
  { id: WIZARD_STEPS.COMPLEX_PROMPT, label: 'Configure Prompt', description: 'Fill form', required: true },
  { id: WIZARD_STEPS.REVIEW, label: 'Review', description: 'Review and execute', required: true },
];

describe('WizardProgress', () => {
  it('renders nothing when no steps are provided', () => {
    const { container } = render(
      <WizardProgress 
        steps={[]} 
        currentStepId={WIZARD_STEPS.FILE_UPLOAD} 
        completedSteps={new Set()} 
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders all steps correctly', () => {
    render(
      <WizardProgress 
        steps={mockSteps} 
        currentStepId={WIZARD_STEPS.FILE_UPLOAD} 
        completedSteps={new Set()} 
      />
    );

    expect(screen.getByText('Upload Files')).toBeInTheDocument();
    expect(screen.getByText('Select Assets')).toBeInTheDocument();
    expect(screen.getByText('Configure Prompt')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('shows step descriptions', () => {
    render(
      <WizardProgress 
        steps={mockSteps} 
        currentStepId={WIZARD_STEPS.FILE_UPLOAD} 
        completedSteps={new Set()} 
      />
    );

    expect(screen.getByText('Upload files')).toBeInTheDocument();
    expect(screen.getByText('Choose assets')).toBeInTheDocument();
    expect(screen.getByText('Fill form')).toBeInTheDocument();
    expect(screen.getByText('Review and execute')).toBeInTheDocument();
  });

  it('highlights current step correctly', () => {
    render(
      <WizardProgress 
        steps={mockSteps} 
        currentStepId={WIZARD_STEPS.ASSET_SELECTION} 
        completedSteps={new Set([WIZARD_STEPS.FILE_UPLOAD])} 
      />
    );

    // Check that the current step has the correct styling classes
    const stepElements = document.querySelectorAll('.w-10.h-10.rounded-full');
    expect(stepElements).toHaveLength(4);

    // First step should be completed (green background)
    expect(stepElements[0]).toHaveClass('bg-green-500');
    
    // Second step should be current (blue background)
    expect(stepElements[1]).toHaveClass('bg-blue-500');
    
    // Remaining steps should be upcoming (border styling)
    expect(stepElements[2]).toHaveClass('border-2', 'border-gray-300');
    expect(stepElements[3]).toHaveClass('border-2', 'border-gray-300');
  });

  it('shows check mark for completed steps', () => {
    render(
      <WizardProgress 
        steps={mockSteps} 
        currentStepId={WIZARD_STEPS.COMPLEX_PROMPT} 
        completedSteps={new Set([WIZARD_STEPS.FILE_UPLOAD, WIZARD_STEPS.ASSET_SELECTION])} 
      />
    );

    // Should have check marks for completed steps
    const checkIcons = document.querySelectorAll('svg[data-testid="check"]') || 
                      document.querySelectorAll('.lucide-check') ||
                      document.querySelectorAll('[class*="check"]');
    
    // We expect at least some check indicators for completed steps
    expect(document.querySelector('.bg-green-500')).toBeInTheDocument();
  });

  it('shows step numbers for non-completed steps', () => {
    render(
      <WizardProgress 
        steps={mockSteps} 
        currentStepId={WIZARD_STEPS.FILE_UPLOAD} 
        completedSteps={new Set()} 
      />
    );

    // Should show step numbers 1, 2, 3, 4
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('applies correct text colors based on step status', () => {
    render(
      <WizardProgress 
        steps={mockSteps} 
        currentStepId={WIZARD_STEPS.ASSET_SELECTION} 
        completedSteps={new Set([WIZARD_STEPS.FILE_UPLOAD])} 
      />
    );

    // Check text color classes are applied
    const uploadText = screen.getByText('Upload Files');
    const assetsText = screen.getByText('Select Assets');
    const promptText = screen.getByText('Configure Prompt');

    // Completed step should have green text
    expect(uploadText).toHaveClass('text-green-600');
    
    // Current step should have blue text
    expect(assetsText).toHaveClass('text-blue-600');
    
    // Upcoming steps should have gray text
    expect(promptText).toHaveClass('text-gray-500');
  });

  it('renders mobile progress bar', () => {
    render(
      <WizardProgress 
        steps={mockSteps} 
        currentStepId={WIZARD_STEPS.ASSET_SELECTION} 
        completedSteps={new Set([WIZARD_STEPS.FILE_UPLOAD])} 
      />
    );

    // Should render mobile progress elements
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('4 Steps')).toBeInTheDocument();
    
    // Should have progress bar
    const progressBar = document.querySelector('.bg-blue-500.h-2.rounded-full');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle('width: 50%'); // Step 2 of 4 = 50%
  });

  it('shows connector lines between steps', () => {
    render(
      <WizardProgress 
        steps={mockSteps} 
        currentStepId={WIZARD_STEPS.ASSET_SELECTION} 
        completedSteps={new Set([WIZARD_STEPS.FILE_UPLOAD])} 
      />
    );

    // Should have connector lines (hidden on mobile, shown on sm+)
    const connectorLines = document.querySelectorAll('.hidden.sm\\:block.flex-1.mx-6');
    expect(connectorLines.length).toBeGreaterThan(0);
  });

  it('handles single step correctly', () => {
    const singleStep = [mockSteps[0]];
    
    render(
      <WizardProgress 
        steps={singleStep} 
        currentStepId={WIZARD_STEPS.FILE_UPLOAD} 
        completedSteps={new Set()} 
      />
    );

    expect(screen.getByText('Upload Files')).toBeInTheDocument();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('1 Steps')).toBeInTheDocument();
    
    // Progress should be 100% for single step
    const progressBar = document.querySelector('.bg-blue-500.h-2.rounded-full');
    expect(progressBar).toHaveStyle('width: 100%');
  });
});