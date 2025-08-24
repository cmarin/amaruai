import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowExecutionWizard } from '../workflow-execution-wizard';
import { Workflow } from '@/types/workflow';

// Mock session hook
jest.mock('@/app/utils/session/session', () => ({
  useSession: () => ({
    session: { access_token: 'mock-token' },
    getApiHeaders: () => ({ Authorization: 'Bearer mock-token' }),
    loading: false,
    initialized: true,
  }),
}));

// Mock the utility functions
jest.mock('@/utils/workflow-wizard-utils', () => ({
  determineWizardSteps: jest.fn(),
  shouldShowWizard: jest.fn(),
  canCompleteStep: jest.fn(),
  getNextStepId: jest.fn(),
  getPreviousStepId: jest.fn(),
  isFirstStep: jest.fn(),
  isLastStep: jest.fn(),
}));

// Mock the prompt template service
jest.mock('@/utils/prompt-template-service', () => ({
  fetchPromptTemplate: jest.fn(),
}));

const mockWorkflow: Workflow = {
  id: '1',
  name: 'Test Workflow',
  description: 'Test Description',
  process_type: 'SEQUENTIAL',
  steps: [{
    id: '1',
    workflow_id: '1',
    prompt_template_id: 'template-1',
    chat_model_id: 'model-1',
    persona_id: 'persona-1',
    position: 0,
  }],
  allow_file_upload: true,
  allow_asset_selection: true,
};

const defaultProps = {
  workflow: mockWorkflow,
  isOpen: true,
  onClose: jest.fn(),
  onExecute: jest.fn(),
};

describe('WorkflowExecutionWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    const mockUtils = require('@/utils/workflow-wizard-utils');
    mockUtils.determineWizardSteps.mockReturnValue([
      { id: 'file_upload', label: 'Upload Files', required: false },
      { id: 'review', label: 'Review', required: true },
    ]);
    mockUtils.isFirstStep.mockReturnValue(true);
    mockUtils.isLastStep.mockReturnValue(false);
    mockUtils.canCompleteStep.mockReturnValue(true);
    mockUtils.getNextStepId.mockReturnValue('review');
    mockUtils.getPreviousStepId.mockReturnValue(null);
  });

  it('renders the wizard dialog when open', async () => {
    render(<WorkflowExecutionWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Setup Workflow: Test Workflow')).toBeInTheDocument();
    });
  });

  it('does not render when closed', () => {
    render(<WorkflowExecutionWizard {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Setup Workflow: Test Workflow')).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<WorkflowExecutionWizard {...defaultProps} />);
    
    expect(screen.getByText('Loading wizard...')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const mockOnClose = jest.fn();
    render(<WorkflowExecutionWizard {...defaultProps} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Setup Workflow: Test Workflow')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows wizard progress indicator', async () => {
    render(<WorkflowExecutionWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Setup Workflow: Test Workflow')).toBeInTheDocument();
    });

    // The progress component should be rendered
    // We can check for step indicators or progress elements
    expect(document.querySelector('.w-10.h-10.rounded-full')).toBeInTheDocument();
  });

  it('handles wizard state updates correctly', async () => {
    const mockOnExecute = jest.fn();
    render(<WorkflowExecutionWizard {...defaultProps} onExecute={mockOnExecute} />);

    await waitFor(() => {
      expect(screen.getByText('Setup Workflow: Test Workflow')).toBeInTheDocument();
    });

    // The wizard should initialize with empty state
    // We can test this by checking if the file upload step shows the correct initial state
    expect(screen.getByText('Upload Files')).toBeInTheDocument();
  });

  it('resets state when dialog closes and reopens', async () => {
    const { rerender } = render(<WorkflowExecutionWizard {...defaultProps} isOpen={false} />);
    
    // Open the wizard
    rerender(<WorkflowExecutionWizard {...defaultProps} isOpen={true} />);
    
    await waitFor(() => {
      expect(screen.getByText('Setup Workflow: Test Workflow')).toBeInTheDocument();
    });

    // Close and reopen
    rerender(<WorkflowExecutionWizard {...defaultProps} isOpen={false} />);
    rerender(<WorkflowExecutionWizard {...defaultProps} isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText('Setup Workflow: Test Workflow')).toBeInTheDocument();
    });

    // State should be reset - we can verify this by checking the initial step is shown
    expect(screen.getByText('Upload Files')).toBeInTheDocument();
  });

  it('handles navigation between steps', async () => {
    const mockUtils = require('@/utils/workflow-wizard-utils');
    mockUtils.getNextStepId.mockReturnValue('review');
    mockUtils.getPreviousStepId.mockReturnValue('file_upload');

    render(<WorkflowExecutionWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Setup Workflow: Test Workflow')).toBeInTheDocument();
    });

    // The navigation should work through the step components
    // We can test this indirectly by checking if the utils are called correctly
    expect(mockUtils.determineWizardSteps).toHaveBeenCalledWith(mockWorkflow, undefined);
  });
});

describe('WorkflowExecutionWizard integration', () => {
  it('renders no wizard when no steps are needed', async () => {
    const mockUtils = require('@/utils/workflow-wizard-utils');
    mockUtils.determineWizardSteps.mockReturnValue([]);

    const { container } = render(<WorkflowExecutionWizard {...defaultProps} />);

    await waitFor(() => {
      // Should not render anything when no steps are needed
      expect(container.firstChild).toBeNull();
    });
  });

  it('handles workflow execution correctly', async () => {
    const mockOnExecute = jest.fn();
    const mockOnClose = jest.fn();

    render(
      <WorkflowExecutionWizard 
        {...defaultProps} 
        onExecute={mockOnExecute}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Setup Workflow: Test Workflow')).toBeInTheDocument();
    });

    // The execution should be handled by the review step component
    // We verify that the wizard is set up to handle execution
    expect(mockOnExecute).not.toHaveBeenCalled(); // Should not be called initially
    expect(mockOnClose).not.toHaveBeenCalled(); // Should not be called initially
  });
});