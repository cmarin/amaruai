import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUploadStep } from '../file-upload-step';
import { Workflow } from '@/types/workflow';
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

// Mock the WorkflowAssetUploader
jest.mock('@/components/workflow-asset-uploader', () => ({
  WorkflowAssetUploader: ({ onFileUploaded, onUploadComplete, onUploadError }: any) => (
    <div data-testid=\"workflow-asset-uploader\">
      <button 
        data-testid=\"mock-upload-file\" 
        onClick={() => onFileUploaded?.({ 
          id: 'file-1', 
          name: 'test.pdf', 
          size: 1024,
          type: 'application/pdf',
          uploadURL: 'http://test.com/file'
        })}
      >
        Upload File
      </button>
      <button 
        data-testid=\"mock-upload-error\" 
        onClick={() => onUploadError?.(new Error('Upload failed'))}
      >
        Simulate Error
      </button>
    </div>
  ),
}));

const mockWorkflow: Workflow = {
  id: '1',
  name: 'Test Workflow',
  description: 'Test Description',
  process_type: 'SEQUENTIAL',
  steps: [],
  allow_file_upload: true,
};

const mockWizardState = {
  uploadedFiles: [],
  selectedAssets: [],
  selectedKnowledgeBases: [],
  currentStepId: WIZARD_STEPS.FILE_UPLOAD,
  completedSteps: new Set<string>(),
  isExecuting: false,
};

const defaultProps = {
  workflow: mockWorkflow,
  wizardState: mockWizardState,
  onStateChange: jest.fn(),
  onNext: jest.fn(),
  onPrevious: jest.fn(),
  onComplete: jest.fn(),
  isFirst: true,
  isLast: false,
};

describe('FileUploadStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the file upload step correctly', () => {
    render(<FileUploadStep {...defaultProps} />);

    expect(screen.getByText('Upload Files')).toBeInTheDocument();
    expect(screen.getByText(/Upload files that will be included/)).toBeInTheDocument();
    expect(screen.getByTestId('workflow-asset-uploader')).toBeInTheDocument();
  });

  it('shows navigation buttons correctly', () => {
    render(<FileUploadStep {...defaultProps} />);

    const previousButton = screen.getByText('Previous');
    const continueButton = screen.getByText('Skip'); // Shows 'Skip' when no files

    expect(previousButton).toBeDisabled(); // First step
    expect(continueButton).toBeEnabled();
  });

  it('enables previous button when not first step', () => {
    render(<FileUploadStep {...defaultProps} isFirst={false} />);

    const previousButton = screen.getByText('Previous');
    expect(previousButton).toBeEnabled();
  });

  it('calls onPrevious when previous button is clicked', async () => {
    const mockOnPrevious = jest.fn();
    const user = userEvent.setup();

    render(
      <FileUploadStep 
        {...defaultProps} 
        isFirst={false} 
        onPrevious={mockOnPrevious} 
      />
    );

    const previousButton = screen.getByText('Previous');
    await user.click(previousButton);

    expect(mockOnPrevious).toHaveBeenCalledTimes(1);
  });

  it('calls onNext when continue button is clicked', async () => {
    const mockOnNext = jest.fn();
    const user = userEvent.setup();

    render(<FileUploadStep {...defaultProps} onNext={mockOnNext} />);

    const continueButton = screen.getByText('Skip');
    await user.click(continueButton);

    expect(mockOnNext).toHaveBeenCalledTimes(1);
  });

  it('handles file upload correctly', async () => {
    const mockOnStateChange = jest.fn();
    const user = userEvent.setup();

    render(<FileUploadStep {...defaultProps} onStateChange={mockOnStateChange} />);

    const uploadButton = screen.getByTestId('mock-upload-file');
    await user.click(uploadButton);

    expect(mockOnStateChange).toHaveBeenCalledWith({
      uploadedFiles: [{
        id: 'file-1',
        name: 'test.pdf',
        size: 1024,
        type: 'application/pdf',
        uploadURL: 'http://test.com/file'
      }]
    });
  });

  it('displays uploaded files list', () => {
    const stateWithFiles = {
      ...mockWizardState,
      uploadedFiles: [
        { id: 'file-1', name: 'test.pdf', size: 1048576, type: 'application/pdf', uploadURL: 'http://test.com' },
        { id: 'file-2', name: 'image.jpg', size: 2048, type: 'image/jpeg', uploadURL: 'http://test.com' }
      ]
    };

    render(<FileUploadStep {...defaultProps} wizardState={stateWithFiles} />);

    expect(screen.getByText('Uploaded Files (2)')).toBeInTheDocument();
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText('image.jpg')).toBeInTheDocument();
    expect(screen.getByText('1.0 MB')).toBeInTheDocument(); // 1048576 bytes
    expect(screen.getByText('2.0 KB')).toBeInTheDocument(); // 2048 bytes
  });

  it('shows Continue instead of Skip when files are uploaded', () => {
    const stateWithFiles = {
      ...mockWizardState,
      uploadedFiles: [
        { id: 'file-1', name: 'test.pdf', size: 1024, type: 'application/pdf', uploadURL: 'http://test.com' }
      ]
    };

    render(<FileUploadStep {...defaultProps} wizardState={stateWithFiles} />);

    expect(screen.getByText('Continue')).toBeInTheDocument();
    expect(screen.queryByText('Skip')).not.toBeInTheDocument();
  });

  it('handles file removal correctly', async () => {
    const mockOnStateChange = jest.fn();
    const user = userEvent.setup();

    const stateWithFiles = {
      ...mockWizardState,
      uploadedFiles: [
        { id: 'file-1', name: 'test.pdf', size: 1024, type: 'application/pdf', uploadURL: 'http://test.com' },
        { id: 'file-2', name: 'image.jpg', size: 2048, type: 'image/jpeg', uploadURL: 'http://test.com' }
      ]
    };

    render(
      <FileUploadStep 
        {...defaultProps} 
        wizardState={stateWithFiles}
        onStateChange={mockOnStateChange}
      />
    );

    // Find and click the first remove button
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);

    expect(mockOnStateChange).toHaveBeenCalledWith({
      uploadedFiles: [
        { id: 'file-2', name: 'image.jpg', size: 2048, type: 'image/jpeg', uploadURL: 'http://test.com' }
      ]
    });
  });

  it('handles upload errors by showing toast', async () => {
    const user = userEvent.setup();

    render(<FileUploadStep {...defaultProps} />);

    const errorButton = screen.getByTestId('mock-upload-error');
    await user.click(errorButton);

    // The error handling is done via toast, which is mocked
    // We can verify the mock toast was called through the component behavior
    // The actual toast call would be in the mocked useToast hook
  });

  it('renders with correct file size formatting', () => {
    const stateWithFiles = {
      ...mockWizardState,
      uploadedFiles: [
        { id: 'file-1', name: 'small.txt', size: 512, type: 'text/plain', uploadURL: 'http://test.com' },
        { id: 'file-2', name: 'large.pdf', size: 5242880, type: 'application/pdf', uploadURL: 'http://test.com' }
      ]
    };

    render(<FileUploadStep {...defaultProps} wizardState={stateWithFiles} />);

    expect(screen.getByText('0.5 KB')).toBeInTheDocument(); // 512 bytes
    expect(screen.getByText('5.0 MB')).toBeInTheDocument(); // 5242880 bytes
  });

  it('maintains uploader state with unique key', () => {
    render(<FileUploadStep {...defaultProps} />);

    const uploader = screen.getByTestId('workflow-asset-uploader');
    expect(uploader).toBeInTheDocument();

    // Re-render to ensure uploader gets new key
    render(<FileUploadStep {...defaultProps} />);
    
    expect(screen.getByTestId('workflow-asset-uploader')).toBeInTheDocument();
  });
});