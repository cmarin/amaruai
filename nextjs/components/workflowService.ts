import { fetchWithRetry } from './apiUtils';
import { ApiHeaders } from '@/app/utils/session/session';
import { API_BASE_URL } from './apiConfig';

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
}

export async function fetchWorkflows(headers: ApiHeaders): Promise<Workflow[]> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }

    const response = await fetch(`${API_BASE_URL}/workflows`, {
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to fetch workflows');
    }
    return await response.json();
  });
}

export async function fetchWorkflow(id: string, headers: ApiHeaders): Promise<Workflow> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }
    const response = await fetch(`${API_BASE_URL}/workflows/${id}`, {
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to fetch workflow');
    }
    return await response.json();
  });
}

export async function createWorkflow(workflow: Omit<Workflow, 'id'>, headers: ApiHeaders): Promise<Workflow> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }

    const workflowPayload = {
      name: workflow.name,
      description: workflow.description,
      process_type: workflow.process_type,
    };

    console.log('Creating workflow with payload:', workflowPayload);

    const response = await fetch(`${API_BASE_URL}/workflows`, {
      method: 'POST',
      headers: {
        ...headers,
      },
      body: JSON.stringify(workflowPayload),
    });

    if (!response.ok) {
      throw new Error('Failed to create workflow');
    }

    const createdWorkflow = await response.json();
    console.log('Created workflow:', createdWorkflow);

    // Create workflow steps
    const createdSteps = await Promise.all(workflow.steps.map(step => 
      createWorkflowStep(createdWorkflow.id, step, headers)
    ));

    console.log('Created steps:', createdSteps);

    return {
      ...createdWorkflow,
      steps: createdSteps,
    };
  });
}

export async function updateWorkflow(id: string, workflow: Partial<Workflow>, headers: ApiHeaders): Promise<Workflow> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }

    const workflowPayload = {
      name: workflow.name,
      description: workflow.description,
      process_type: workflow.process_type,
    };

    console.log('Updating workflow with payload:', workflowPayload);

    const response = await fetch(`${API_BASE_URL}/workflows/${id}`, {
      method: 'PUT',
      headers: {
        ...headers,
      },
      body: JSON.stringify(workflowPayload),
    });

    if (!response.ok) {
      throw new Error('Failed to update workflow');
    }

    const updatedWorkflow = await response.json();

    // Fetch current steps
    const currentSteps = await fetchWorkflowSteps(id, headers);

    // Delete all existing steps
    await Promise.all(currentSteps.map(step => {
      if (step.id) {
        return deleteWorkflowStep(id, step.id, headers);
      }
      return Promise.resolve();
    }));

    // Create new steps
    if (workflow.steps) {
      const createdSteps = await Promise.all(workflow.steps.map(step => 
        createWorkflowStep(id, {
          prompt_template_id: step.prompt_template_id,
          chat_model_id: step.chat_model_id,
          persona_id: step.persona_id,
          position: step.position
        }, headers)
      ));
      updatedWorkflow.steps = createdSteps;
    }

    return updatedWorkflow;
  });
}

export async function deleteWorkflow(id: string, headers: ApiHeaders): Promise<void> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }
    const response = await fetch(`${API_BASE_URL}/workflows/${id}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to delete workflow');
    }
  });
}

export async function createWorkflowStep(workflowId: string, step: Omit<WorkflowStep, 'id' | 'workflow_id'>, headers: ApiHeaders): Promise<WorkflowStep> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }
    console.log('Creating workflow step:', step);
    const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}/steps`, {
      method: 'POST',
      headers: {
        ...headers,
      },
      body: JSON.stringify(step),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error creating workflow step:', errorText);
      throw new Error('Failed to create workflow step');
    }
    const createdStep = await response.json();
    console.log('Created workflow step:', createdStep);
    return createdStep;
  });
}

export async function fetchWorkflowSteps(workflowId: string, headers: ApiHeaders): Promise<WorkflowStep[]> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }
    const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}/steps`, {
      headers
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching workflow steps:', errorText);
      throw new Error('Failed to fetch workflow steps');
    }
    return await response.json();
  });
}

export async function deleteWorkflowStep(workflowId: string, stepId: string, headers: ApiHeaders): Promise<void> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }
    const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}/steps/${stepId}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to delete workflow step');
    }
  });
}

export async function executeWorkflow(
  workflowId: string, 
  userId: string, 
  conversationId: string, 
  headers: ApiHeaders,
  message?: string
): Promise<void> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }
    const url = `${API_BASE_URL}/workflows/${workflowId}/execute`;
    const payload: any = {
      user_id: userId,
      conversation_id: conversationId,
    };

    if (message) {
      payload.message = message;
    }
    
    console.log('Executing workflow:');
    console.log('URL:', url);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (!response.ok) {
      throw new Error(`Failed to execute workflow: ${response.status} ${response.statusText}\n${responseText}`);
    }
  });
}

export interface WorkflowResult {
  step: string;
  prompt: string;
  response: string;
}

export async function getWorkflowResults(workflowId: string, headers: ApiHeaders): Promise<WorkflowResult[]> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }
    const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}/results`, {
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to fetch workflow results');
    }
    return await response.json();
  });
}

export async function updateWorkflowStep(
  workflowId: string, 
  stepId: string, 
  step: Partial<WorkflowStep>, 
  headers: ApiHeaders
): Promise<WorkflowStep> {
  return fetchWithRetry(async () => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not defined');
    }
    console.log('Updating workflow step:', step);
    const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}/steps/${stepId}`, {
      method: 'PUT',
      headers: {
        ...headers,
      },
      body: JSON.stringify(step),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error updating workflow step:', errorText);
      throw new Error('Failed to update workflow step');
    }
    const updatedStep = await response.json();
    console.log('Updated workflow step:', updatedStep);
    return updatedStep;
  });
}

export interface WorkflowStreamMessage {
  step?: string;
  prompt?: string;
  response?: string;
  type: 'step' | 'completion' | 'error';
  error?: string;
  content?: string;
  message?: string;
}

export function streamWorkflow(
  workflowId: string,
  userId: string,
  conversationId: string,
  headers: ApiHeaders,
  onMessage: (message: WorkflowStreamMessage) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
  message?: string
): () => void {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL is not defined');
  }

  const initUrl = `${API_BASE_URL}/workflows/${workflowId}/stream`;
  let eventSource: EventSource | null = null;
  let isCompleting = false;
  let hasReceivedMessage = false;
  
  console.log('Initiating workflow stream POST request...');
  
  // First make the POST request to initiate the stream
  fetch(initUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      conversation_id: conversationId,
      ...(message && { message }),
    }),
  }).then(async response => {
    console.log('POST response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('POST request failed:', errorText);
      throw new Error('Failed to initiate workflow stream');
    }
    
    const responseData = await response.json();
    console.log('POST response data:', responseData);
    const { stream_token } = responseData;
    
    const streamUrl = `${API_BASE_URL}/workflows/${workflowId}/stream?stream_token=${stream_token}`;
    console.log('Creating EventSource with URL:', streamUrl);
    
    try {
      eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        console.log('EventSource connection opened');
      };

      eventSource.onmessage = (event: MessageEvent) => {
        console.log('Received SSE message:', event.data);
        try {
          const data = JSON.parse(event.data);
          hasReceivedMessage = true;
          
          if (data.type === 'error') {
            console.error('Server error:', data.message);
            onError(new Error(data.message || 'Unknown server error'));
            if (eventSource) {
              eventSource.close();
            }
            return;
          }
          
          if (data.type === 'content') {
            onMessage({
              type: 'step',
              response: data.content,
              step: '1',
              prompt: 'Initial prompt'
            });
            
            // Assume this is the only message we'll receive
            console.log('Content received, initiating graceful completion');
            isCompleting = true;
            if (eventSource) {
              eventSource.close();
              onComplete();
            }
          } else {
            onMessage(data as WorkflowStreamMessage);

            if (data.type === 'completion' || data.type === 'complete' || 
                (data.type === 'status' && data.message === 'Workflow execution completed')) {
              console.log('Received completion message, closing connection');
              isCompleting = true;
              if (eventSource) {
                eventSource.close();
                onComplete();
              }
            }
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (event: Event) => {
        console.error('SSE Error:', event);
        
        // If we've received a message and the connection closes, treat it as completion
        if (hasReceivedMessage) {
          console.log('Connection closed after receiving message, treating as completion');
          isCompleting = true;
          if (eventSource) {
            eventSource.close();
          }
          onComplete();
          return;
        }

        // If we're completing, this is an expected error
        if (isCompleting) {
          console.log('Connection closed after completion');
          return;
        }

        // Log error details
        const errorEvent = event as ErrorEvent;
        if (errorEvent.error) {
          console.error('Error details:', errorEvent.error);
        }
        if (errorEvent.message) {
          console.error('Error message:', errorEvent.message);
        }

        // Only report error if we haven't received any messages
        if (!hasReceivedMessage && !isCompleting) {
          if (eventSource) {
            eventSource.close();
          }
          onError(new Error('Stream connection error'));
        }
      };
    } catch (error) {
      console.error('Error creating EventSource:', error);
      onError(new Error('Failed to create stream connection'));
    }

  }).catch(error => {
    console.error('Error initiating workflow stream:', error);
    onError(error instanceof Error ? error : new Error('Unknown error occurred'));
  });

  return () => {
    if (eventSource) {
      console.log('Cleaning up EventSource connection');
      eventSource.close();
    }
  };
}