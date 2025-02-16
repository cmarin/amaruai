import { fetchWithRetry, getApiUrl } from './api-utils';
import { UploadedFile } from './upload-service';

export interface BatchFlowStep {
  prompt_template_id: string;
  chat_model_id: string;
  persona_id: string;
}

export interface BatchFlowRequest {
  file_ids: string[];
  knowledge_base_ids?: string[];
  asset_ids?: string[];
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
  onProgress?: (message: BatchFlowStreamMessage) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void,
): Promise<void> {
  try {
    const response = await fetch(`${getApiUrl()}/api/batch-flow/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const message = JSON.parse(line) as BatchFlowStreamMessage;
            if (message.type === 'error') {
              onError?.(new Error(message.error));
            } else {
              onProgress?.(message);
            }
          } catch (e) {
            console.error('Error parsing message:', e);
          }
        }
      }
    } finally {
      reader.releaseLock();
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