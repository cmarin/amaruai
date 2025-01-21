'use client';

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Workflow, WorkflowStep, createWorkflow, updateWorkflow } from '../utils/workflow-service'
import { PromptTemplate, fetchPromptTemplates } from '@/utils/prompt-template-service'
import { ChatModel, fetchChatModels } from '../utils/chat-model-service'
import { Persona, fetchPersonas } from '../utils/persona-service'
import { useSession } from '@/app/utils/session/session';

interface WorkflowManagerProps {
  workflow?: Workflow | null;
  onSave: () => void;
  onCancel: () => void;
}

export function WorkflowManagerComponent({ workflow: initialWorkflow, onSave, onCancel }: WorkflowManagerProps) {
  const [workflow, setWorkflow] = useState<Workflow>(initialWorkflow || {
    name: "",
    description: "",
    process_type: "SEQUENTIAL",
    steps: [],
  });
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [managerChatModelId, setManagerChatModelId] = useState<string | undefined>(undefined);
  const [managerPersonaId, setManagerPersonaId] = useState<string | undefined>(undefined);
  const [maxIterations, setMaxIterations] = useState<number>(5);
  const { getApiHeaders, loading: sessionLoading, initialized } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      console.log('Loading workflow manager data...');
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      const [templatesData, modelsData, personasData] = await Promise.all([
        fetchPromptTemplates(headers),
        fetchChatModels(headers),
        fetchPersonas(headers)
      ]);

      console.log('Data loaded:', {
        promptTemplates: templatesData,
        chatModels: modelsData,
        personas: personasData
      });

      setPromptTemplates(templatesData);
      setChatModels(modelsData);
      setPersonas(personasData);
      setError(null);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load necessary data');
    } finally {
      setIsLoading(false);
    }
  }, [getApiHeaders]);

  useEffect(() => {
    if (!sessionLoading && initialized) {
      loadData();
    }
  }, [sessionLoading, initialized, loadData]);

  useEffect(() => {
    if (initialWorkflow) {
      console.log('Setting initial workflow:', initialWorkflow);
      setWorkflow(initialWorkflow);
      if (initialWorkflow.process_type === 'HIERARCHICAL') {
        console.log('Setting hierarchical values:', {
          manager_chat_model_id: initialWorkflow.manager_chat_model_id,
          manager_persona_id: initialWorkflow.manager_persona_id,
          max_iterations: initialWorkflow.max_iterations
        });
        setManagerChatModelId(initialWorkflow.manager_chat_model_id?.toString());
        setManagerPersonaId(initialWorkflow.manager_persona_id?.toString());
        setMaxIterations(initialWorkflow.max_iterations || 5);
      }
    }
  }, [initialWorkflow]);

  const handleProcessTypeChange = (value: "SEQUENTIAL" | "HIERARCHICAL") => {
    setWorkflow({ ...workflow, process_type: value });
    if (value === 'HIERARCHICAL' && chatModels.length > 0 && personas.length > 0) {
      const defaultModel = chatModels[0];
      const defaultPersona = personas[0];
      setManagerChatModelId(defaultModel?.id?.toString());
      setManagerPersonaId(defaultPersona?.id?.toString());
      setMaxIterations(5);
    }
  };

  const addStep = () => {
    if (!promptTemplates.length || !chatModels.length || !personas.length) {
      console.error('Missing required data for creating step');
      return;
    }

    const defaultTemplate = promptTemplates[0];
    const defaultModel = chatModels[0];
    const defaultPersona = personas[0];

    if (!defaultTemplate?.id || !defaultModel?.id || !defaultPersona?.id) {
      console.error('Missing required IDs for step creation');
      return;
    }

    const newStep: WorkflowStep = {
      id: crypto.randomUUID(),
      workflow_id: workflow.id || crypto.randomUUID(),
      prompt_template_id: defaultTemplate.id,
      chat_model_id: defaultModel.id.toString(),
      persona_id: defaultPersona.id.toString(),
      position: workflow.steps.length,
    };
    setWorkflow({ ...workflow, steps: [...workflow.steps, newStep] });
  };

  const updateStep = (index: number, field: keyof WorkflowStep, value: string) => {
    const updatedSteps = [...workflow.steps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const removeStep = (index: number) => {
    const updatedSteps = workflow.steps.filter((_, i) => i !== index);
    // Update positions after removal
    const reorderedSteps = updatedSteps.map((step, i) => ({
      ...step,
      position: i
    }));
    setWorkflow({ ...workflow, steps: reorderedSteps });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === workflow.steps.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updatedSteps = [...workflow.steps];
    const step = updatedSteps[index];
    updatedSteps[index] = updatedSteps[newIndex];
    updatedSteps[newIndex] = step;

    // Update positions after move
    const reorderedSteps = updatedSteps.map((step, i) => ({
      ...step,
      position: i
    }));
    setWorkflow({ ...workflow, steps: reorderedSteps });
  };

  const handleSave = async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      const workflowToSave: Workflow = {
        ...workflow,
        steps: workflow.steps.map((step, index) => ({
          ...step,
          position: index
        }))
      };

      if (workflow.process_type === 'HIERARCHICAL') {
        workflowToSave.manager_chat_model_id = managerChatModelId;
        workflowToSave.manager_persona_id = managerPersonaId;
        workflowToSave.max_iterations = maxIterations;
      }

      if (workflow.id) {
        await updateWorkflow(workflow.id, workflowToSave, headers);
      } else {
        await createWorkflow(workflowToSave, headers);
      }

      onSave();
    } catch (error) {
      console.error('Error saving workflow:', error);
    }
  };

  if (sessionLoading || !initialized) {
    return <div>Initializing session...</div>;
  }

  if (isLoading) {
    return <div>Loading workflow data...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{workflow.id ? 'Edit Workflow' : 'Create Workflow'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={workflow.name}
              onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={workflow.description}
              onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="processType">Process Type</Label>
            <Select
              value={workflow.process_type}
              onValueChange={handleProcessTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select process type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEQUENTIAL">Sequential</SelectItem>
                <SelectItem value="HIERARCHICAL">Hierarchical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {workflow.process_type === 'HIERARCHICAL' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="managerChatModel">Manager Model</Label>
                <Select
                  value={managerChatModelId || ""}
                  onValueChange={setManagerChatModelId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager chat model" />
                  </SelectTrigger>
                  <SelectContent>
                    {chatModels.map((model) => (
                      <SelectItem key={model.id} value={model.id?.toString() || ""}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="managerPersona">Manager Persona</Label>
                <Select
                  value={managerPersonaId || ""}
                  onValueChange={setManagerPersonaId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager persona" />
                  </SelectTrigger>
                  <SelectContent>
                    {personas.map((persona) => (
                      <SelectItem key={persona.id} value={persona.id.toString()}>
                        {persona.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="maxIterations">Max Iterations</Label>
                <Input
                  id="maxIterations"
                  type="number"
                  min={1}
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflow.steps.map((step, index) => (
            <div key={index} className="flex items-start space-x-4">
              <div className="flex-1 space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Step {index + 1}</span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveStep(index, 'up')}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveStep(index, 'down')}
                    disabled={index === workflow.steps.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Select
                    value={step.prompt_template_id}
                    onValueChange={(value) => updateStep(index, "prompt_template_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select prompt template" />
                    </SelectTrigger>
                    <SelectContent>
                      {promptTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={step.chat_model_id}
                    onValueChange={(value) => updateStep(index, "chat_model_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select chat model" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatModels.map((model) => (
                        <SelectItem key={model.id} value={model.id?.toString() || ""}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={step.persona_id}
                    onValueChange={(value) => updateStep(index, "persona_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select persona" />
                    </SelectTrigger>
                    <SelectContent>
                      {personas.map((persona) => (
                        <SelectItem key={persona.id} value={persona.id.toString()}>
                          {persona.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
          <Button onClick={addStep} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add Step
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          {workflow.id ? 'Save Changes' : 'Create Workflow'}
        </Button>
      </div>
    </div>
  );
}
