import { fetchWithRetry, getApiUrl } from './api-utils';
import { UploadedFile } from './upload-service';

export interface BatchFlowStep {
  prompt_template_id: string;
  chat_model_id: string;
  persona_id: string;
}

export interface BatchFlowRequest {
  file_ids: string[];
  steps: BatchFlowStep[];
  customInstructions?: string;
}

export interface BatchFlowResult {
  fileId: string;
  fileName: string;
  stepResults: {
    prompt: string;
    response: string;
    chat_model: {
      id: number;
      name: string;
      model: string;
    };
    persona: {
      id: number;
      role: string;
      goal: string;
    };
  }[];
}

export interface BatchFlowStreamMessage {
  type: 'progress' | 'completion' | 'error';
  fileId?: string;
  fileName?: string;
  currentStep?: number;
  totalSteps?: number;
  response?: string;
  error?: string;
}

export interface AssetStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'max_attempts_exceeded' | 'failed';
  token_count: number;
  file_name: string;
}

export async function executeBatchFlow(
  request: BatchFlowRequest,
  accessToken: string,
  onMessage?: (message: BatchFlowStreamMessage) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void,
): Promise<void> {
  try {
    const response = await fetch(`${getApiUrl()}/batch-flow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to execute batch flow');
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const messages = chunk
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as BatchFlowStreamMessage);

      for (const message of messages) {
        if (message.type === 'error') {
          onError?.(new Error(message.error));
        } else {
          onMessage?.(message);
        }
      }
    }

    onComplete?.();
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Unknown error occurred'));
  }
}

export async function getAssetStatus(url: string, accessToken: string): Promise<AssetStatus> {
  const response = await fetch(`${getApiUrl()}/assets/status?url=${encodeURIComponent(url)}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch asset status');
  }

  return await response.json();
}
