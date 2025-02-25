'use client';

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EyeIcon, Trash2Icon } from "lucide-react";
import { ComboboxPersonas } from "@/components/combobox-personas";
import { ComboboxChatModels } from "@/components/combobox-chat-models";
import { ComboboxPromptTemplates } from "@/components/combobox-prompt-templates";
import type { BatchFlowStep, PromptTemplateOption, ChatModelOption, PersonaOption } from "@/types";
import type { Persona } from "@/utils/persona-service";
import type { ChatModel } from "@/components/data-context";
import { useState } from 'react';

interface WorkflowStepsProps {
  steps: BatchFlowStep[];
  onUpdateStep: (index: number, field: keyof BatchFlowStep, value: string) => void;
  onRemoveStep: (index: number) => void;
  onAddStep: () => void;
  promptTemplates: PromptTemplateOption[];
  chatModels: ChatModelOption[];
  personas: PersonaOption[];
  userChangedValues?: {[key: number]: {model: boolean, persona: boolean}};
  onUserChangedValues?: React.Dispatch<React.SetStateAction<{[key: number]: {model: boolean, persona: boolean}}>>;
}

export function WorkflowSteps({
  steps,
  onUpdateStep,
  onRemoveStep,
  onAddStep,
  promptTemplates,
  chatModels,
  personas,
  userChangedValues: externalUserChangedValues,
  onUserChangedValues
}: WorkflowStepsProps) {
  // Track whether each step's model/persona has been manually changed
  const [internalUserChangedValues, setInternalUserChangedValues] = useState<{[key: number]: {model: boolean, persona: boolean}}>({});
  
  // Use external values if provided, otherwise use internal state
  const userChangedValues = externalUserChangedValues || internalUserChangedValues;
  const setUserChangedValues = onUserChangedValues || setInternalUserChangedValues;
  
  // Add key to force re-renders when needed
  const [refreshKey, setRefreshKey] = useState(0);

  // Function to force a refresh of the component
  const forceRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleModelChange = (index: number, modelId: string) => {
    console.log('Model changed:', modelId);
    const finalValue = modelId === 'none' ? '' : modelId;
    console.log('Setting model to:', finalValue);
    
    // Update the state to track that the user changed this value
    setUserChangedValues(prev => ({
      ...prev,
      [index]: { ...(prev[index] || { persona: false }), model: true }
    }));
    
    // Pass the change up to the parent
    onUpdateStep(index, 'chat_model_id', finalValue);
  };

  const handlePersonaChange = (index: number, personaId: string) => {
    console.log('Persona changed:', personaId);
    const finalValue = personaId === 'none' ? '' : personaId;
    console.log('Setting persona to:', finalValue);
    
    // Update the state to track that the user changed this value
    setUserChangedValues(prev => ({
      ...prev,
      [index]: { ...(prev[index] || { model: false }), persona: true }
    }));
    
    // Pass the change up to the parent
    onUpdateStep(index, 'persona_id', finalValue);
  };

  return (
    <div className="space-y-6" key={refreshKey}>
      {steps.map((step, index) => (
        <div key={index} className="flex gap-4 items-start p-4 border rounded-lg bg-slate-50">
          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Prompt Template</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ComboboxPromptTemplates
                      templates={promptTemplates}
                      value={step.prompt_template_id || null}
                      onSelect={(template) => {
                        console.log('Selected template in WorkflowSteps:', template);
                        
                        if (template) {
                          // First update the prompt template id
                          onUpdateStep(index, 'prompt_template_id', template.id);
                          
                          // Get the user's change status for this step
                          const hasUserChangedModel = userChangedValues[index]?.model || false;
                          const hasUserChangedPersona = userChangedValues[index]?.persona || false;
                          
                          console.log('User changed values:', { model: hasUserChangedModel, persona: hasUserChangedPersona });
                          
                          // Clear any user changes when selecting a template
                          setUserChangedValues(prev => ({
                            ...prev,
                            [index]: { model: false, persona: false }
                          }));
                          
                          // If the template has default values, apply them immediately with a small delay
                          // to ensure that the prompt template update happens first
                          setTimeout(() => {
                            // Ensure we have a string value for persona
                            if (template.default_persona_id && typeof template.default_persona_id === 'string') {
                              console.log('Applying default persona:', template.default_persona_id);
                              onUpdateStep(index, 'persona_id', template.default_persona_id);
                            }
                            
                            // Ensure we have a string value for chat model
                            if (template.default_chat_model_id && typeof template.default_chat_model_id === 'string') {
                              console.log('Applying default chat model:', template.default_chat_model_id);
                              onUpdateStep(index, 'chat_model_id', template.default_chat_model_id);
                            }
                            
                            // Force a refresh to update the UI
                            forceRefresh();
                          }, 10);
                        } else if (template === null) {
                          // This is a special case for re-selection of the same template
                          // We don't want to clear the template ID in this case
                          console.log('Received null template - this is for re-selection, not clearing');
                        } else {
                          onUpdateStep(index, 'prompt_template_id', '');
                        }
                      }}
                    />
                  </div>
                  {step.prompt_template_id && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="max-w-sm">
                          <div className="space-y-2">
                            <p className="font-medium">Template</p>
                            <p className="text-sm whitespace-pre-wrap">
                              {typeof promptTemplates.find(t => t.id === step.prompt_template_id)?.prompt === 'string' 
                                ? promptTemplates.find(t => t.id === step.prompt_template_id)?.prompt as string 
                                : 'No prompt defined'}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Persona</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ComboboxPersonas
                      personas={personas as unknown as Persona[]}
                      value={step.persona_id || null}
                      onSelect={(persona) => handlePersonaChange(index, persona ? persona.id.toString() : '')}
                    />
                  </div>
                  {step.persona_id && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="max-w-sm">
                          <div className="space-y-2">
                            <p className="font-medium">Persona</p>
                            <p className="text-sm whitespace-pre-wrap">
                              {personas.find(p => p.id === step.persona_id)?.role || 'No role defined'}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Chat Model</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ComboboxChatModels
                      models={chatModels.map(model => ({
                        ...model,
                        model_id: model.id,
                        default: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_favorite: false,
                        model: model.name,
                        provider: 'unknown',
                        api_key: '',
                        max_tokens: 2048,
                        temperature: 0.7
                      }))}
                      value={step.chat_model_id || null}
                      onSelect={(model) => handleModelChange(index, model ? model.id.toString() : '')}
                    />
                  </div>
                  {step.chat_model_id && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="max-w-sm">
                          <div className="space-y-2">
                            <p className="font-medium">Chat Model</p>
                            <p className="text-sm whitespace-pre-wrap">
                              {chatModels.find(m => m.id === step.chat_model_id)?.name || 'No model defined'}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemoveStep(index)}
            disabled={steps.length === 1}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2Icon className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        onClick={onAddStep}
        className="mt-4"
      >
        Add Step
      </Button>
    </div>
  );
}
