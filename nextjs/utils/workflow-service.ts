import { fetchWithRetry } from './api-utils';
import { ApiHeaders } from '@/app/utils/session/session';
import { getApiUrl, getFetchOptions } from './api-utils';

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
  manager_chat_model_id?: string;
  manager_persona_id?: string;
  max_iterations?: number;
}

export interface WorkflowResult {
  step: string;
  prompt: string;
  response: string;
  chat_model?: {
    id: string;
    name: string;
    model: string;
  };
  persona?: {
    id: string;
    role: string;
    goal: string;
  };
}

export interface WorkflowStreamMessage {
  step?: string | number;
  prompt?: string;
  response?: string;
  type: 'step' | 'completion' | 'error' | 'status';
  error?: string;
  content?: string;
  message?: string;
  chat_model?: {
    id: string;
    name: string;
    model: string;
  };
  persona?: {
    id: string;
    role: string;
    goal: string;
  };
}

export async function fetchWorkflows(headers: ApiHeaders): Promise<Workflow[]> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/workflows`, {
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to fetch workflows');
    }
    const data = await response.json();
    return data.map((workflow: any) => ({
      ...workflow,
      id: workflow.id?.toString() || '',
      manager_chat_model_id: workflow.manager_chat_model_id?.toString(),
      manager_persona_id: workflow.manager_persona_id?.toString(),
      steps: workflow.steps?.map((step: any) => ({
        ...step,
        id: step.id?.toString() || '',
        workflow_id: step.workflow_id?.toString() || '',
        prompt_template_id: step.prompt_template_id?.toString() || '',
        chat_model_id: step.chat_model_id?.toString() || '',
        persona_id: step.persona_id?.toString() || '',
        prompt_template: step.prompt_template ? {
          ...step.prompt_template,
          id: step.prompt_template.id?.toString() || ''
        } : undefined,
        chat_model: step.chat_model ? {
          ...step.chat_model,
          id: step.chat_model.id?.toString() || ''
        } : undefined,
        persona: step.persona ? {
          ...step.persona,
          id: step.persona.id?.toString() || ''
        } : undefined
      })) || []
    }));
  });
}

export async function fetchWorkflow(id: string, headers: ApiHeaders): Promise<Workflow> {
  return fetchWithRetry(async () => {
    console.log('Fetching workflow with ID:', id);
    console.log('API URL:', getApiUrl());
    
    const response = await fetch(`${getApiUrl()}/workflows/${id}`, {
      headers,
      cache: 'no-store' // Disable caching to always get fresh data
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching workflow:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to fetch workflow: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const workflow = {
      ...data,
      id: data.id?.toString() || '',
      manager_chat_model_id: data.manager_chat_model_id?.toString(),
      manager_persona_id: data.manager_persona_id?.toString(),
      steps: data.steps?.map((step: any) => ({
        ...step,
        id: step.id?.toString() || '',
        workflow_id: step.workflow_id?.toString() || '',
        prompt_template_id: step.prompt_template_id?.toString() || '',
        chat_model_id: step.chat_model_id?.toString() || '',
        persona_id: step.persona_id?.toString() || '',
        prompt_template: step.prompt_template ? {
          ...step.prompt_template,
          id: step.prompt_template.id?.toString() || ''
        } : undefined,
        chat_model: step.chat_model ? {
          ...step.chat_model,
          id: step.chat_model.id?.toString() || ''
        } : undefined,
        persona: step.persona ? {
          ...step.persona,
          id: step.persona.id?.toString() || ''
        } : undefined
      })) || []
    };
    console.log('Successfully fetched workflow:', workflow);
    return workflow;
  });
}

export async function createWorkflow(workflow: Omit<Workflow, 'id'>, headers: ApiHeaders): Promise<Workflow> {
  return fetchWithRetry(async () => {
    const workflowPayload = {
      name: workflow.name,
      description: workflow.description,
      process_type: workflow.process_type,
    };

    console.log('Creating workflow with payload:', workflowPayload);

    const response = await fetch(`${getApiUrl()}/workflows`, {
      method: 'POST',
      headers: {
        ...headers,
      },
      body: JSON.stringify(workflowPayload),
    });

    if (!response.ok) {
      throw new Error('Failed to create workflow');
    }

    const data = await response.json();
    const createdWorkflow = {
      ...data,
      id: data.id?.toString() || '',
      manager_chat_model_id: data.manager_chat_model_id?.toString(),
      manager_persona_id: data.manager_persona_id?.toString(),
      steps: data.steps?.map((step: any) => ({
        ...step,
        id: step.id?.toString() || '',
        workflow_id: step.workflow_id?.toString() || '',
        prompt_template_id: step.prompt_template_id?.toString() || '',
        chat_model_id: step.chat_model_id?.toString() || '',
        persona_id: step.persona_id?.toString() || '',
        prompt_template: step.prompt_template ? {
          ...step.prompt_template,
          id: step.prompt_template.id?.toString() || ''
        } : undefined,
        chat_model: step.chat_model ? {
          ...step.chat_model,
          id: step.chat_model.id?.toString() || ''
        } : undefined,
        persona: step.persona ? {
          ...step.persona,
          id: step.persona.id?.toString() || ''
        } : undefined
      })) || []
    };
    console.log('Created workflow:', createdWorkflow);

    // Create workflow steps sequentially to ensure correct positioning
    const createdSteps = [];
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const stepWithPosition = {
        ...step,
        position: i  // Explicitly set position based on array index
      };
      
      const createdStep = await createWorkflowStep(createdWorkflow.id, stepWithPosition, headers);
      createdSteps.push(createdStep);
    }

    console.log('Created steps:', createdSteps);

    return {
      ...createdWorkflow,
      steps: createdSteps,
    };
  });
}

export async function updateWorkflow(id: string, workflow: Partial<Workflow>, headers: ApiHeaders): Promise<Workflow> {
  return fetchWithRetry(async () => {
    const workflowPayload = {
      name: workflow.name,
      description: workflow.description,
      process_type: workflow.process_type,
      manager_chat_model_id: workflow.manager_chat_model_id,
      manager_persona_id: workflow.manager_persona_id,
      max_iterations: workflow.max_iterations,
      steps: workflow.steps?.map((step, index) => ({
        prompt_template_id: step.prompt_template_id,
        chat_model_id: step.chat_model_id,
        persona_id: step.persona_id,
        position: index
      }))
    };

    console.log('Updating workflow with payload:', workflowPayload);

    const response = await fetch(`${getApiUrl()}/workflows/${id}`, {
      method: 'PUT',
      headers: {
        ...headers,
      },
      body: JSON.stringify(workflowPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error updating workflow:', errorText);
      throw new Error(`Failed to update workflow: ${errorText}`);
    }

    const data = await response.json();
    const updatedWorkflow = {
      ...data,
      id: data.id?.toString() || '',
      manager_chat_model_id: data.manager_chat_model_id?.toString(),
      manager_persona_id: data.manager_persona_id?.toString(),
      steps: data.steps?.map((step: any) => ({
        ...step,
        id: step.id?.toString() || '',
        workflow_id: step.workflow_id?.toString() || '',
        prompt_template_id: step.prompt_template_id?.toString() || '',
        chat_model_id: step.chat_model_id?.toString() || '',
        persona_id: step.persona_id?.toString() || '',
        prompt_template: step.prompt_template ? {
          ...step.prompt_template,
          id: step.prompt_template.id?.toString() || ''
        } : undefined,
        chat_model: step.chat_model ? {
          ...step.chat_model,
          id: step.chat_model.id?.toString() || ''
        } : undefined,
        persona: step.persona ? {
          ...step.persona,
          id: step.persona.id?.toString() || ''
        } : undefined
      })) || []
    };
    return updatedWorkflow;
  });
}

export async function deleteWorkflow(id: string, headers: ApiHeaders): Promise<void> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/workflows/${id}`, {
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
    console.log('Creating workflow step:', step);
    const response = await fetch(`${getApiUrl()}/workflows/${workflowId}/steps`, {
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
    const data = await response.json();
    const createdStep = {
      ...data,
      id: data.id?.toString() || '',
      workflow_id: data.workflow_id?.toString() || '',
      prompt_template_id: data.prompt_template_id?.toString() || '',
      chat_model_id: data.chat_model_id?.toString() || '',
      persona_id: data.persona_id?.toString() || '',
      prompt_template: data.prompt_template ? {
        ...data.prompt_template,
        id: data.prompt_template.id?.toString() || ''
      } : undefined,
      chat_model: data.chat_model ? {
        ...data.chat_model,
        id: data.chat_model.id?.toString() || ''
      } : undefined,
      persona: data.persona ? {
        ...data.persona,
        id: data.persona.id?.toString() || ''
      } : undefined
    };
    console.log('Created workflow step:', createdStep);
    return createdStep;
  });
}

export async function fetchWorkflowSteps(workflowId: string, headers: ApiHeaders): Promise<WorkflowStep[]> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/workflows/${workflowId}/steps`, {
      headers
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching workflow steps:', errorText);
      throw new Error('Failed to fetch workflow steps');
    }
    const data = await response.json();
    return data.map((step: any) => ({
      ...step,
      id: step.id?.toString() || '',
      workflow_id: step.workflow_id?.toString() || '',
      prompt_template_id: step.prompt_template_id?.toString() || '',
      chat_model_id: step.chat_model_id?.toString() || '',
      persona_id: step.persona_id?.toString() || '',
      prompt_template: step.prompt_template ? {
        ...step.prompt_template,
        id: step.prompt_template.id?.toString() || ''
      } : undefined,
      chat_model: step.chat_model ? {
        ...step.chat_model,
        id: step.chat_model.id?.toString() || ''
      } : undefined,
      persona: step.persona ? {
        ...step.persona,
        id: step.persona.id?.toString() || ''
      } : undefined
    }));
  });
}

export async function deleteWorkflowStep(workflowId: string, stepId: string, headers: ApiHeaders): Promise<void> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/workflows/${workflowId}/steps/${stepId}`, {
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
    const url = `${getApiUrl()}/workflows/${workflowId}/execute`;
    const payload: {
      user_id: string;
      conversation_id: string;
      message?: string;
    } = {
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

export async function getWorkflowResults(workflowId: string, headers: ApiHeaders): Promise<WorkflowResult[]> {
  return fetchWithRetry(async () => {
    const response = await fetch(`${getApiUrl()}/workflows/${workflowId}/results`, {
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to fetch workflow results');
    }
    const data = await response.json();
    return data.map((result: any) => ({
      ...result,
      chat_model: result.chat_model ? {
        ...result.chat_model,
        id: result.chat_model.id?.toString() || ''
      } : undefined,
      persona: result.persona ? {
        ...result.persona,
        id: result.persona.id?.toString() || ''
      } : undefined
    }));
  });
}

export async function updateWorkflowStep(
  workflowId: string, 
  stepId: string, 
  step: Partial<WorkflowStep>, 
  headers: ApiHeaders
): Promise<WorkflowStep> {
  return fetchWithRetry(async () => {
    console.log('Updating workflow step:', step);
    const response = await fetch(`${getApiUrl()}/workflows/${workflowId}/steps/${stepId}`, {
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
    const data = await response.json();
    const updatedStep = {
      ...data,
      id: data.id?.toString() || '',
      workflow_id: data.workflow_id?.toString() || '',
      prompt_template_id: data.prompt_template_id?.toString() || '',
      chat_model_id: data.chat_model_id?.toString() || '',
      persona_id: data.persona_id?.toString() || '',
      prompt_template: data.prompt_template ? {
        ...data.prompt_template,
        id: data.prompt_template.id?.toString() || ''
      } : undefined,
      chat_model: data.chat_model ? {
        ...data.chat_model,
        id: data.chat_model.id?.toString() || ''
      } : undefined,
      persona: data.persona ? {
        ...data.persona,
        id: data.persona.id?.toString() || ''
      } : undefined
    };
    console.log('Updated workflow step:', updatedStep);
    return updatedStep;
  });
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
  const initUrl = `${getApiUrl()}/workflows/${workflowId}/stream`;
  let eventSource: EventSource | null = null;
  let isCompleting = false;
  
  console.log('Starting workflow stream...');
  
  const payload = {
    user_id: userId,
    conversation_id: conversationId,
    ...(message && { message: message })
  };

  console.log('Sending payload:', payload);
  
  // First initiate the stream
  fetch(initUrl, {
    ...getFetchOptions({
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  }).then(async response => {
    if (!response.ok) {
      throw new Error('Failed to initiate workflow stream');
    }
    
    const { stream_token } = await response.json();
    const streamUrl = new URL(`${getApiUrl()}/workflows/${workflowId}/stream`);
    streamUrl.searchParams.append('stream_token', stream_token);
    console.log('Stream URL:', streamUrl.toString());
    
    try {
      // Create EventSource with proper configuration
      const eventSourceInit: EventSourceInit = {
        withCredentials: true
      };
      
      eventSource = new EventSource(streamUrl.toString(), eventSourceInit);
      console.log('EventSource created');

      eventSource.onopen = () => {
        console.log('EventSource connection opened');
      };

      // Listen for message events
      eventSource.addEventListener('message', (event: MessageEvent) => {
        console.log('Message event received:', event.data);
        try {
          const data = JSON.parse(event.data);
          console.log('Parsed message data:', data);
          
          const message: WorkflowStreamMessage = {
            type: 'step',
            step: data.step,
            prompt: data.content,
            response: data.content,
            ...(data.role && { role: data.role })
          };
          
          console.log('Dispatching workflow message:', message);
          window.requestAnimationFrame(() => {
            onMessage(message);
          });
        } catch (error) {
          console.error('Error parsing message event:', error);
          console.error('Raw event data:', event.data);
        }
      });

      // Listen for done events
      eventSource.addEventListener('done', (event: MessageEvent) => {
        console.log('Done event received:', event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'completed') {
            console.log('Workflow completed, closing connection');
            isCompleting = true;
            eventSource?.close();
            onComplete();
          }
        } catch (error) {
          console.error('Error parsing done event:', error);
          console.error('Raw event data:', event.data);
        }
      });

      // Handle connection errors
      eventSource.onerror = (event: Event) => {
        console.error('EventSource error:', event);
        const source = event.target as EventSource;
        
        if (source.readyState === EventSource.CLOSED && !isCompleting) {
          console.log('Connection closed unexpectedly');
          eventSource?.close();
          onError(new Error('Stream connection closed unexpectedly'));
        } else if (source.readyState === EventSource.CONNECTING) {
          console.log('Connection lost, attempting to reconnect...');
        }
      };

    } catch (error) {
      console.error('Error creating EventSource:', error);
      onError(error instanceof Error ? error : new Error('Failed to create stream connection'));
    }

  }).catch(error => {
    console.error('Error initiating workflow stream:', error);
    onError(error instanceof Error ? error : new Error('Unknown error occurred'));
  });

  return () => {
    if (eventSource) {
      console.log('Cleaning up EventSource');
      eventSource.close();
    }
  };
}