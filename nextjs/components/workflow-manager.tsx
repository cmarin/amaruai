'use client';

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WorkflowSteps } from "@/components/batch-flow/workflow-steps"
import { KnowledgeBaseSelector } from "@/components/knowledge-base-selector"

import { Workflow, WorkflowStep, createWorkflow, updateWorkflow } from '../utils/workflow-service'
import { PromptTemplate, fetchPromptTemplates } from '@/utils/prompt-template-service'
import { ChatModel, fetchChatModels } from '../utils/chat-model-service'
import { Persona, fetchPersonas } from '../utils/persona-service'
import { KnowledgeBase, fetchKnowledgeBases } from '@/utils/knowledge-base-service'
import { Asset } from '@/types/knowledge-base'
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
    knowledge_base_ids: [],
    asset_ids: [],
  });
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
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

      const [
        promptTemplatesData,
        chatModelsData,
        personasData,
        knowledgeBasesData,
      ] = await Promise.all([
        fetchPromptTemplates(headers),
        fetchChatModels(headers),
        fetchPersonas(headers),
        fetchKnowledgeBases(headers),
      ]);

      setPromptTemplates(promptTemplatesData);
      setChatModels(chatModelsData);
      setPersonas(personasData);
      setKnowledgeBases(knowledgeBasesData);
      setError(null);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
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
      
      // Initialize selected knowledge bases from workflow data
      if (initialWorkflow.knowledge_base_ids && initialWorkflow.knowledge_base_ids.length > 0) {
        const selectedKBs = knowledgeBases.filter(kb => 
          initialWorkflow.knowledge_base_ids?.includes(kb.id)
        );
        setSelectedKnowledgeBases(selectedKBs);
      }

      // Initialize selected assets
      if (initialWorkflow.asset_ids && initialWorkflow.asset_ids.length > 0) {
        const selectedAssetsList = assets.filter(asset => 
          initialWorkflow.asset_ids?.includes(asset.id)
        );
        setSelectedAssets(selectedAssetsList);
      }

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
  }, [initialWorkflow, knowledgeBases, assets]);

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
        })),
        knowledge_base_ids: selectedKnowledgeBases.map(kb => kb.id),
        asset_ids: selectedAssets.map(asset => asset.id)
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

      <div className="space-y-4">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Bases & Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <KnowledgeBaseSelector
                  knowledgeBases={knowledgeBases}
                  isLoadingKnowledgeBases={isLoadingKnowledgeBases}
                  selectedKnowledgeBases={selectedKnowledgeBases}
                  selectedAssets={selectedAssets}
                  onSelectKnowledgeBase={(kb: KnowledgeBase) => {
                    setSelectedKnowledgeBases(prev => [...prev, kb]);
                    setWorkflow(prev => ({
                      ...prev,
                      knowledge_base_ids: [...(prev.knowledge_base_ids || []), kb.id]
                    }));
                  }}
                  onDeselectKnowledgeBase={(kb: KnowledgeBase) => {
                    setSelectedKnowledgeBases(prev => prev.filter(k => k.id !== kb.id));
                    setWorkflow(prev => ({
                      ...prev,
                      knowledge_base_ids: (prev.knowledge_base_ids || []).filter(id => id !== kb.id)
                    }));
                  }}
                  onSelectAsset={(asset: Asset) => {
                    setSelectedAssets(prev => [...prev, asset]);
                    setWorkflow(prev => ({
                      ...prev,
                      asset_ids: [...(prev.asset_ids || []), asset.id]
                    }));
                  }}
                  onDeselectAsset={(asset: Asset) => {
                    setSelectedAssets(prev => prev.filter(a => a.id !== asset.id));
                    setWorkflow(prev => ({
                      ...prev,
                      asset_ids: (prev.asset_ids || []).filter(id => id !== asset.id)
                    }));
                  }}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowSteps
                steps={workflow.steps}
                onUpdateStep={updateStep}
                onRemoveStep={removeStep}
                onAddStep={addStep}
                promptTemplates={promptTemplates}
                chatModels={chatModels}
                personas={personas.map(p => ({
                  id: String(p.id),
                  role: p.role
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>

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
