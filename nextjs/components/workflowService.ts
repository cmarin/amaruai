import { fetchWithRetry } from './apiUtils';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

export async function fetchWorkflows(): Promise<Workflow[]> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/workflows`);
    if (!response.ok) {
      throw new Error('Failed to fetch workflows');
    }
    return await response.json();
  });
}

export async function fetchWorkflow(id: string): Promise<Workflow> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/workflows/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch workflow');
    }
    return await response.json();
  });
}

export async function createWorkflow(workflow: Omit<Workflow, 'id'>): Promise<Workflow> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }

    const workflowPayload = {
      name: workflow.name,
      description: workflow.description,
      process_type: workflow.process_type,
    };

    console.log('Creating workflow with payload:', workflowPayload);

    const response = await fetch(`${API_URL}/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      createWorkflowStep(createdWorkflow.id, step)
    ));

    console.log('Created steps:', createdSteps);

    return {
      ...createdWorkflow,
      steps: createdSteps,
    };
  });
}

export async function updateWorkflow(id: string, workflow: Partial<Workflow>): Promise<Workflow> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }

    const workflowPayload = {
      name: workflow.name,
      description: workflow.description,
      process_type: workflow.process_type,
    };

    console.log('Updating workflow with payload:', workflowPayload);

    // Update workflow details
    const response = await fetch(`${API_URL}/workflows/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowPayload),
    });

    if (!response.ok) {
      throw new Error('Failed to update workflow');
    }

    const updatedWorkflow = await response.json();

    // Fetch current steps
    const currentSteps = await fetchWorkflowSteps(id);

    // Delete all existing steps
    await Promise.all(currentSteps.map(step => {
      if (step.id) {
        return deleteWorkflowStep(id, step.id);
      }
      return Promise.resolve(); // If step.id is undefined, return a resolved promise
    }));

    // Create new steps
    if (workflow.steps) {
      const createdSteps = await Promise.all(workflow.steps.map(step => 
        createWorkflowStep(id, {
          prompt_template_id: step.prompt_template_id,
          chat_model_id: step.chat_model_id,
          persona_id: step.persona_id,
          position: step.position
        })
      ));
      updatedWorkflow.steps = createdSteps;
    }

    console.log('Updated workflow:', updatedWorkflow);
    return updatedWorkflow;
  });
}

export async function deleteWorkflow(id: string): Promise<void> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/workflows/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete workflow');
    }
  });
}

export async function createWorkflowStep(workflowId: string, step: Omit<WorkflowStep, 'id' | 'workflow_id'>): Promise<WorkflowStep> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    console.log('Creating workflow step:', step);
    const response = await fetch(`${API_URL}/workflows/${workflowId}/steps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

export async function updateWorkflowStep(workflowId: string, stepId: string, step: Partial<WorkflowStep>): Promise<WorkflowStep> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    console.log('Updating workflow step:', step);
    const response = await fetch(`${API_URL}/workflows/${workflowId}/steps/${stepId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
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

export async function fetchWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/workflows/${workflowId}/steps`);
    if (!response.ok) {
      throw new Error('Failed to fetch workflow steps');
    }
    return await response.json();
  });
}

export async function deleteWorkflowStep(workflowId: string, stepId: string): Promise<void> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/workflows/${workflowId}/steps/${stepId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete workflow step');
    }
  });
}

export async function executeWorkflow(workflowId: string, userId: string, conversationId: string, message?: string): Promise<void> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const url = `${API_URL}/workflows/${workflowId}/execute`;
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
        'Content-Type': 'application/json',
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

export async function getWorkflowResults(workflowId: string): Promise<WorkflowResult[]> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    const response = await fetch(`${API_URL}/workflows/${workflowId}/results`);
    if (!response.ok) {
      throw new Error('Failed to fetch workflow results');
    }
    return await response.json();
  });
}
