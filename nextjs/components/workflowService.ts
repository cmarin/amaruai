import { fetchWithRetry } from './apiUtils';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface WorkflowStep {
  id?: string;
  workflow_id?: string;
  prompt_template_id: string;
  chat_model_id: string;
  persona_id: string;
  order: number;
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

    // First, create the workflow without steps
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

    // Then, create all workflow steps
    const createdSteps = await Promise.all(workflow.steps.map(step => 
      createWorkflowStep({ ...step, workflow_id: createdWorkflow.id })
    ));

    console.log('Created steps:', createdSteps);

    // Return the workflow with the created steps
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

    // If steps are provided, update them first
    if (workflow.steps) {
      await Promise.all(workflow.steps.map(step => 
        step.id ? updateWorkflowStep(id, step.id, step) : createWorkflowStep({ ...step, workflow_id: id })
      ));
    }

    const response = await fetch(`${API_URL}/workflows/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflow),
    });

    if (!response.ok) {
      throw new Error('Failed to update workflow');
    }

    return await response.json();
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

export async function createWorkflowStep(step: Omit<WorkflowStep, 'id'>): Promise<WorkflowStep> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
    }
    console.log('Creating workflow step:', step);
    const response = await fetch(`${API_URL}/workflows/${step.workflow_id}/steps`, {
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
    const response = await fetch(`${API_URL}/workflows/${workflowId}/steps/${stepId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(step),
    });
    if (!response.ok) {
      throw new Error('Failed to update workflow step');
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
