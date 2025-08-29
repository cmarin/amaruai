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
import { KnowledgeBaseAssetPills } from "@/components/knowledge-base-asset-pills"
import { WorkflowAssetSelectionConfig } from "@/components/workflow-asset-selection-config"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

import { createWorkflow, updateWorkflow } from '../utils/workflow-service'
import { Workflow, WorkflowStep } from '@/types/workflow'
import { PromptTemplate, fetchPromptTemplates } from '@/utils/prompt-template-service'
import { ChatModel, fetchChatModels } from '../utils/chat-model-service'
import { Persona, fetchPersonas } from '../utils/persona-service'
import { KnowledgeBase, fetchKnowledgeBases } from '@/utils/knowledge-base-service'
import { Asset } from '@/types/knowledge-base'
import { fetchAssets } from '@/utils/asset-service'
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
    search: false,
    allow_file_upload: false,
    allow_asset_selection: false,
    asset_selection_config: undefined,
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
  const [isKnowledgeBaseSelectorOpen, setIsKnowledgeBaseSelectorOpen] = useState(false);
  const { getApiHeaders, loading: sessionLoading, initialized } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track which steps have had their values manually changed
  const [userChangedValues, setUserChangedValues] = useState<{[key: number]: {model: boolean, persona: boolean}}>({});

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
        assetsData
      ] = await Promise.all([
        fetchPromptTemplates(headers),
        fetchChatModels(headers),
        fetchPersonas(headers),
        fetchKnowledgeBases(headers),
        fetchAssets(headers)
      ]);

      console.log('Loaded knowledge bases:', knowledgeBasesData);
      console.log('Loaded assets:', assetsData);

      setPromptTemplates(promptTemplatesData);
      setChatModels(chatModelsData);
      setPersonas(personasData);
      setKnowledgeBases(knowledgeBasesData);
      setAssets(assetsData);
      
      // If we have an initial workflow, initialize the selected knowledge bases and assets
      if (initialWorkflow) {
        console.log('Initial workflow knowledge_base_ids:', initialWorkflow.knowledge_base_ids);
        console.log('Initial workflow asset_ids:', initialWorkflow.asset_ids);
        
        if (initialWorkflow.knowledge_base_ids && initialWorkflow.knowledge_base_ids.length > 0) {
          const selectedKBs = knowledgeBasesData.filter(kb => 
            initialWorkflow.knowledge_base_ids?.some(id => 
              id === kb.id || id === kb.id.toString() || id.toString() === kb.id
            )
          );
          console.log('Initializing selected knowledge bases:', selectedKBs);
          setSelectedKnowledgeBases(selectedKBs);
        }
        
        if (initialWorkflow.asset_ids && initialWorkflow.asset_ids.length > 0) {
          const selectedAssetsList = assetsData.filter(asset => 
            initialWorkflow.asset_ids?.some(id => 
              id === asset.id || id === asset.id.toString() || id.toString() === asset.id
            )
          );
          console.log('Initializing selected assets:', selectedAssetsList);
          setSelectedAssets(selectedAssetsList);
        }
      }
      
      setError(null);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [getApiHeaders, initialWorkflow]);

  useEffect(() => {
    if (!sessionLoading && initialized) {
      loadData();
    }
  }, [sessionLoading, initialized]);

  useEffect(() => {
    if (initialWorkflow) {
      console.log('Setting initial workflow:', initialWorkflow);
      
      // Make sure search and dynamic input settings are properly initialized
      const workflowWithSettings = {
        ...initialWorkflow,
        search: initialWorkflow.search || false,
        allow_file_upload: initialWorkflow.allow_file_upload || false,
        allow_asset_selection: initialWorkflow.allow_asset_selection || false
      };
      
      setWorkflow(workflowWithSettings);
      
      // Check if we have direct assets and knowledge_bases arrays from the API
      if (initialWorkflow.assets && initialWorkflow.assets.length > 0) {
        console.log('Found direct assets in workflow:', initialWorkflow.assets);
        setSelectedAssets(initialWorkflow.assets);
        
        // Also update the workflow's asset_ids to match
        setWorkflow(prev => ({
          ...prev,
          asset_ids: initialWorkflow.assets?.map(asset => asset.id) || []
        }));
      } 
      // Fall back to asset_ids if direct assets aren't available
      else if (initialWorkflow.asset_ids && initialWorkflow.asset_ids.length > 0) {
        const selectedAssetsList = assets.filter(asset => 
          initialWorkflow.asset_ids?.some(id => 
            id === asset.id || id === asset.id.toString() || id.toString() === asset.id
          )
        );
        setSelectedAssets(selectedAssetsList);
      }

      // Same for knowledge bases
      if (initialWorkflow.knowledge_bases && initialWorkflow.knowledge_bases.length > 0) {
        console.log('Found direct knowledge_bases in workflow:', initialWorkflow.knowledge_bases);
        setSelectedKnowledgeBases(initialWorkflow.knowledge_bases);
        
        // Also update the workflow's knowledge_base_ids to match
        setWorkflow(prev => ({
          ...prev,
          knowledge_base_ids: initialWorkflow.knowledge_bases?.map(kb => kb.id) || []
        }));
      } 
      // Fall back to knowledge_base_ids if direct knowledge_bases aren't available
      else if (initialWorkflow.knowledge_base_ids && initialWorkflow.knowledge_base_ids.length > 0) {
        const selectedKBs = knowledgeBases.filter(kb => 
          initialWorkflow.knowledge_base_ids?.some(id => 
            id === kb.id || id === kb.id.toString() || id.toString() === kb.id
          )
        );
        setSelectedKnowledgeBases(selectedKBs);
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

  useEffect(() => {
    console.log('Selected knowledge bases changed:', selectedKnowledgeBases);
    console.log('Selected assets changed:', selectedAssets);
  }, [selectedKnowledgeBases, selectedAssets]);

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
    const newStep: WorkflowStep = {
      id: crypto.randomUUID(),
      workflow_id: workflow.id || crypto.randomUUID(),
      prompt_template_id: '',
      chat_model_id: '',
      persona_id: '',
      position: workflow.steps.length,
    };
    setWorkflow({ ...workflow, steps: [...workflow.steps, newStep] });
  };

  const updateStep = (index: number, field: keyof WorkflowStep, value: string) => {
    console.log(`Updating step ${index}, field ${field} to value:`, value);
    
    // Create a new array of steps
    const updatedSteps = [...workflow.steps];
    
    // Update the step with the new value
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    
    // First update the workflow with the basic change
    setWorkflow(prevWorkflow => ({
      ...prevWorkflow,
      steps: updatedSteps
    }));

    // If updating prompt template, handle defaults
    if (field === 'prompt_template_id') {
      const template = promptTemplates.find(t => t.id === value);
      
      // Always reset the user changed values when selecting a template
      setUserChangedValues(prev => ({
        ...prev,
        [index]: { model: false, persona: false }
      }));

      if (template) {
        console.log('Selected template:', template);
        console.log('Template defaults:', {
          default_persona_id: template.default_persona_id,
          default_chat_model_id: template.default_chat_model_id
        });
        
        // Store the template ID for reference in the setTimeout
        const selectedTemplateId = value;
        
        // Use setTimeout to ensure the prompt_template_id update happens first
        setTimeout(() => {
          console.log('Applying template defaults after delay');
          // Get fresh copy of steps to ensure we're working with the latest state
          // Careful: We need to preserve the prompt_template_id that was just set
          setWorkflow(prevWorkflow => {
            const currentSteps = [...prevWorkflow.steps];
            let hasUpdates = false;
            
            // Make sure the prompt_template_id is still set correctly
            if (currentSteps[index].prompt_template_id !== selectedTemplateId) {
              console.log('Warning: prompt_template_id was lost, restoring it');
              currentSteps[index].prompt_template_id = selectedTemplateId;
              hasUpdates = true;
            }
            
            // Apply defaults
            if (template.default_chat_model_id) {
              console.log('Applying default chat model:', template.default_chat_model_id);
              currentSteps[index].chat_model_id = template.default_chat_model_id;
              hasUpdates = true;
            }
            
            if (template.default_persona_id) {
              console.log('Applying default persona:', template.default_persona_id);
              currentSteps[index].persona_id = template.default_persona_id;
              hasUpdates = true;
            }
            
            console.log('Step after applying defaults:', currentSteps[index]);
            
            // Only update if needed
            if (hasUpdates) {
              return {
                ...prevWorkflow,
                steps: currentSteps
              };
            }
            
            // No changes needed
            return prevWorkflow;
          });
        }, 100); // Delay to ensure prompt_template_id is set first
      }
    } else if (field === 'chat_model_id') {
      // Track when user manually changes model
      setUserChangedValues(prev => ({
        ...prev,
        [index]: { ...(prev[index] || { persona: false }), model: true }
      }));
    } else if (field === 'persona_id') {
      // Track when user manually changes persona
      setUserChangedValues(prev => ({
        ...prev,
        [index]: { ...(prev[index] || { model: false }), persona: true }
      }));
    }

    console.log('Updated step:', updatedSteps[index]);
  };

  const removeStep = (index: number) => {
    const updatedSteps = workflow.steps.filter((_, i) => i !== index);
    // Update positions after removal
    const reorderedSteps = updatedSteps.map((step, i) => ({
      ...step,
      position: i
    }));
    // Clean up user changes tracking for removed step
    const newUserChangedValues = { ...userChangedValues };
    delete newUserChangedValues[index];
    setUserChangedValues(newUserChangedValues);
    
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
        asset_ids: selectedAssets.map(asset => asset.id),
        search: workflow.search || false,
        allow_file_upload: workflow.allow_file_upload || false,
        allow_asset_selection: workflow.allow_asset_selection || false,
        asset_selection_config: workflow.asset_selection_config
      };

      console.log('Saving workflow with data:', workflowToSave);

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

          <div className="flex items-center space-x-2">
            <Label 
              htmlFor="search-enabled" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Enable search
            </Label>
            
            <Checkbox 
              id="search-enabled" 
              checked={workflow.search || false}
              onCheckedChange={(checked) => {
                setWorkflow({ ...workflow, search: checked === true });
              }}
            />
          </div>

          <Separator className="my-4" />
          
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="font-semibold">Dynamic Input Settings</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-file-upload"
                checked={workflow?.allow_file_upload || false}
                onCheckedChange={(checked) => {
                  if (workflow) {
                    setWorkflow({
                      ...workflow,
                      allow_file_upload: checked as boolean
                    });
                  }
                }}
              />
              <Label htmlFor="allow-file-upload" className="cursor-pointer">
                Allow users to upload files at runtime
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-asset-selection"
                checked={workflow?.allow_asset_selection || false}
                onCheckedChange={(checked) => {
                  if (workflow) {
                    setWorkflow({
                      ...workflow,
                      allow_asset_selection: checked as boolean
                    });
                  }
                }}
              />
              <Label htmlFor="allow-asset-selection" className="cursor-pointer">
                Allow users to select assets and knowledge bases at runtime
              </Label>
            </div>
            
            <p className="text-sm text-gray-500">
              When enabled, users will be prompted to upload files or select existing resources before executing the workflow.
            </p>
          </div>

          <Separator className="my-4" />

          {/* Individual Asset Selection Configuration */}
          <WorkflowAssetSelectionConfig
            knowledgeBases={knowledgeBases}
            config={workflow.asset_selection_config}
            onChange={(config) => {
              setWorkflow({
                ...workflow,
                asset_selection_config: config
              });
            }}
          />

          <Separator className="my-4" />

          <div className="space-y-2">
            <Label htmlFor="knowledgeBases">Knowledge Bases & Assets</Label>
            <Button 
              variant="outline" 
              className="w-full h-10"
              onClick={() => setIsKnowledgeBaseSelectorOpen(true)}
            >
              Select
            </Button>
            {selectedKnowledgeBases.length === 0 && selectedAssets.length === 0 && !isKnowledgeBaseSelectorOpen && (
              <p className="text-sm text-muted-foreground mt-1">No knowledge bases or assets selected</p>
            )}
            <KnowledgeBaseAssetPills
              knowledgeBases={selectedKnowledgeBases}
              assets={selectedAssets}
              onRemoveKnowledgeBase={(kb: KnowledgeBase) => {
                setSelectedKnowledgeBases(prev => prev.filter(k => k.id !== kb.id));
                setWorkflow(prev => ({
                  ...prev,
                  knowledge_base_ids: (prev.knowledge_base_ids || []).filter(id => id !== kb.id)
                }));
              }}
              onRemoveAsset={(asset: Asset) => {
                setSelectedAssets(prev => prev.filter(a => a.id !== asset.id));
                setWorkflow(prev => ({
                  ...prev,
                  asset_ids: (prev.asset_ids || []).filter(id => id !== asset.id)
                }));
              }}
            />
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
              open={isKnowledgeBaseSelectorOpen}
              onOpenChange={setIsKnowledgeBaseSelectorOpen}
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
            userChangedValues={userChangedValues}
            onUserChangedValues={setUserChangedValues}
          />
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
