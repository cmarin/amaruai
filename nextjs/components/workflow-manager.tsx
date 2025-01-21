"use client"

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
  const { getApiHeaders, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (initialWorkflow) {
      console.log('Initial workflow loaded:', initialWorkflow);
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

  useEffect(() => {
    if (!sessionLoading) {
      const fetchData = async () => {
        const headers = getApiHeaders();
        if (!headers) {
          console.error('No valid headers available');
          return;
        }
        try {
          const [fetchedPromptTemplates, fetchedChatModels, fetchedPersonas] = await Promise.all([
            fetchPromptTemplates(headers),
            fetchChatModels(headers),
            fetchPersonas(headers)
          ]);
          setPromptTemplates(fetchedPromptTemplates);
          setChatModels(fetchedChatModels);
          setPersonas(fetchedPersonas);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      fetchData();
    }
  }, [sessionLoading, getApiHeaders]);

  useEffect(() => {
    if (workflow.process_type === 'HIERARCHICAL' && chatModels.length > 0 && personas.length > 0) {
      console.log('Updating manager IDs after data load');
      console.log('Available chat models:', chatModels);
      console.log('Available personas:', personas);
      console.log('Current managerChatModelId:', managerChatModelId);
      console.log('Current managerPersonaId:', managerPersonaId);
      
      // Only set if not already set
      if (!managerChatModelId && workflow.manager_chat_model_id) {
        setManagerChatModelId(workflow.manager_chat_model_id?.toString());
      }
      if (!managerPersonaId && workflow.manager_persona_id) {
        setManagerPersonaId(workflow.manager_persona_id?.toString());
      }
    }
  }, [workflow.process_type, chatModels, personas, managerChatModelId, managerPersonaId, workflow.manager_chat_model_id, workflow.manager_persona_id]);

  useEffect(() => {
    if (workflow.manager_chat_model_id) {
      setManagerChatModelId(workflow.manager_chat_model_id);
    }
    if (workflow.manager_persona_id) {
      setManagerPersonaId(workflow.manager_persona_id);
    }
  }, [
    workflow.manager_chat_model_id,
    workflow.manager_persona_id,
    managerChatModelId,
    managerPersonaId,
    setManagerChatModelId,
    setManagerPersonaId
  ]);

  const handleProcessTypeChange = (value: "SEQUENTIAL" | "HIERARCHICAL") => {
    setWorkflow({ ...workflow, process_type: value });
    if (value === 'HIERARCHICAL') {
      setManagerChatModelId(chatModels[0]?.id?.toString());
      setManagerPersonaId(personas[0]?.id?.toString());
      setMaxIterations(5);
    }
  };

  const addStep = () => {
    const newStep: WorkflowStep = {
      prompt_template_id: promptTemplates[0]?.id.toString() || "",
      chat_model_id: chatModels[0]?.id.toString() || "",
      persona_id: personas[0]?.id.toString() || "",
      position: workflow.steps.length,
    }
    setWorkflow({ ...workflow, steps: [...workflow.steps, newStep] })
  }

  const removeStep = (index: number) => {
    setWorkflow({
      ...workflow,
      steps: workflow.steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, position: i })),
    })
  }

  const updateStep = (index: number, field: keyof WorkflowStep, value: string) => {
    setWorkflow({
      ...workflow,
      steps: workflow.steps.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
    })
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...workflow.steps];
    
    if (direction === 'up' && index > 0) {
      // Swap the steps
      [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
      
      // Update positions to match new order
      newSteps[index - 1].position = index - 1;
      newSteps[index].position = index;
      
    } else if (direction === 'down' && index < newSteps.length - 1) {
      // Swap the steps
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
      
      // Update positions to match new order
      newSteps[index].position = index;
      newSteps[index + 1].position = index + 1;
    }
    
    setWorkflow({ ...workflow, steps: newSteps });
  };

  const handleSave = async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      const workflowPayload = {
        name: workflow.name,
        description: workflow.description,
        process_type: workflow.process_type,
        steps: workflow.steps,
        ...(workflow.process_type === 'HIERARCHICAL' && {
          manager_chat_model_id: managerChatModelId,
          manager_persona_id: managerPersonaId,
          max_iterations: maxIterations,
        }),
      };

      console.log('Workflow payload to be sent:', JSON.stringify(workflowPayload, null, 2));

      let savedWorkflow;
      if (workflow.id) {
        savedWorkflow = await updateWorkflow(workflow.id, workflowPayload, headers);
      } else {
        savedWorkflow = await createWorkflow(workflowPayload, headers);
      }
      console.log('Workflow saved successfully:', savedWorkflow);
      
      // Only call onSave after the workflow and all steps are saved
      onSave();
    } catch (error) {
      console.error('Error saving workflow:', error);
    }
  };

  return (
    <div className="w-full h-full min-h-screen p-6">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={workflow.name}
                onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
                placeholder="Workflow Name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={workflow.description}
                onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
                placeholder="Workflow Description"
              />
            </div>
            <div>
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
            {workflow.process_type === 'HIERARCHICAL' && chatModels.length > 0 && personas.length > 0 && (
              <>
                <div>
                  <Label htmlFor="managerChatModel">Manager Model</Label>
                  <Select
                    value={managerChatModelId?.toString() || ''}
                    onValueChange={(value) => {
                      console.log('Setting manager chat model ID:', value);
                      setManagerChatModelId(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager chat model">
                        {(() => {
                          const selectedModel = chatModels.find(model => 
                            model.id.toString() === managerChatModelId?.toString()
                          );
                          console.log('Looking for model with ID:', managerChatModelId);
                          console.log('Found model:', selectedModel);
                          return selectedModel?.name || 'Select model';
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {chatModels.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="managerPersona">Manager Persona</Label>
                  <Select
                    value={managerPersonaId?.toString() || ''}
                    onValueChange={(value) => {
                      console.log('Setting manager persona ID:', value);
                      setManagerPersonaId(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager persona">
                        {(() => {
                          const selectedPersona = personas.find(persona => 
                            persona.id.toString() === managerPersonaId?.toString()
                          );
                          console.log('Looking for persona with ID:', managerPersonaId);
                          console.log('Found persona:', selectedPersona);
                          return selectedPersona?.role || 'Select persona';
                        })()}
                      </SelectValue>
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
                  <Label htmlFor="maxIterations">Max Iterations Per Agent</Label>
                  <Input
                    id="maxIterations"
                    type="number"
                    value={maxIterations}
                    onChange={(e) => setMaxIterations(Number(e.target.value))}
                    placeholder="Max Iterations"
                  />
                </div>
              </>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflow.steps.map((step, index) => (
              <div key={index} className="border p-4 rounded-md bg-muted mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Step {index + 1}</h3>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === workflow.steps.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => removeStep(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Select
                    value={step.prompt_template_id?.toString()}
                    onValueChange={(value) => updateStep(index, "prompt_template_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select prompt template" />
                    </SelectTrigger>
                    <SelectContent>
                      {promptTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={step.chat_model_id?.toString()}
                    onValueChange={(value) => updateStep(index, "chat_model_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select chat model" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatModels.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={step.persona_id?.toString()}
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
            ))}
          </div>
          <Button onClick={addStep} className="mt-4 bg-blue-500 hover:bg-blue-600 text-white">
            <Plus className="mr-2 h-4 w-4" /> Add Step
          </Button>
        </CardContent>
      </Card>
      <div className="flex justify-end space-x-4 mt-4">
        <Button onClick={onCancel} variant="outline">Cancel</Button>
        <Button onClick={handleSave} className="bg-green-500 hover:bg-green-600 text-white">
          Save Workflow
        </Button>
      </div>
    </div>
  )
}
