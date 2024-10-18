import { fetchWithRetry } from './apiUtils';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface Workflow {
  id: string;
  name: string;
  description: string;
  process_type: 'SEQUENTIAL' | 'HIERARCHICAL';
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  prompt_template_id: string;
  chat_model_id: string;
  persona_id: string;
  order: number;
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
    const response = await fetch(`${API_URL}/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflow),
    });
    if (!response.ok) {
      throw new Error('Failed to create workflow');
    }
    return await response.json();
  });
}

export async function updateWorkflow(id: string, workflow: Partial<Workflow>): Promise<Workflow> {
  return fetchWithRetry(async () => {
    if (!API_URL) {
      throw new Error('API_URL is not defined');
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
