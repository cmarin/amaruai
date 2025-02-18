'use client';

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EyeIcon, Trash2 } from "lucide-react";
import type { BatchFlowStep } from "@/types";
import type { PromptTemplateOption, ChatModelOption, PersonaOption } from "@/types";
import { useState } from 'react';

interface WorkflowStepsProps {
  steps: BatchFlowStep[];
  onUpdateStep: (index: number, field: keyof BatchFlowStep, value: string) => void;
  onRemoveStep: (index: number) => void;
  onAddStep: () => void;
  promptTemplates: PromptTemplateOption[];
  chatModels: ChatModelOption[];
  personas: PersonaOption[];
}

export function WorkflowSteps({
  steps,
  onUpdateStep,
  onRemoveStep,
  onAddStep,
  promptTemplates,
  chatModels,
  personas,
}: WorkflowStepsProps) {
  // Track whether each step's model/persona has been manually changed
  const [userChangedValues, setUserChangedValues] = useState<{[key: number]: {model: boolean, persona: boolean}}>({});

  const handlePromptChange = (index: number, promptId: string) => {
    onUpdateStep(index, 'prompt_template_id', promptId);
    
    // Find the selected prompt template
    const template = promptTemplates.find(t => t.id === promptId);
    
    // Only update if template exists and has defaults
    if (template) {
      // Check if user has changed values for this step
      const stepChanges = userChangedValues[index] || { model: false, persona: false };
      
      // Update model if it has a default and user hasn't changed it
      if (!stepChanges.model) {
        const modelId = template.default_chat_model_id || 'none';
        onUpdateStep(index, 'chat_model_id', modelId === 'none' ? '' : modelId);
      }
      
      // Update persona if it has a default and user hasn't changed it
      if (!stepChanges.persona) {
        const personaId = template.default_persona_id || 'none';
        onUpdateStep(index, 'persona_id', personaId === 'none' ? '' : personaId);
      }
    }
  };

  const handleModelChange = (index: number, modelId: string) => {
    onUpdateStep(index, 'chat_model_id', modelId === 'none' ? '' : modelId);
    setUserChangedValues(prev => ({
      ...prev,
      [index]: { ...prev[index], model: true }
    }));
  };

  const handlePersonaChange = (index: number, personaId: string) => {
    onUpdateStep(index, 'persona_id', personaId === 'none' ? '' : personaId);
    setUserChangedValues(prev => ({
      ...prev,
      [index]: { ...prev[index], persona: true }
    }));
  };

  return (
    <div className="space-y-6">
      {steps.map((step, index) => (
        <div key={index} className="flex gap-4 items-start p-4 border rounded-lg bg-slate-50">
          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Prompt Template</label>
                <div className="flex items-center gap-2">
                  <Select
                    value={step.prompt_template_id}
                    onValueChange={(value) => handlePromptChange(index, value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select prompt" />
                    </SelectTrigger>
                    <SelectContent>
                      {promptTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                            <p className="font-medium">Prompt Template</p>
                            <p className="text-sm whitespace-pre-wrap">
                              {(() => {
                                const template = promptTemplates.find(t => t.id === step.prompt_template_id);
                                if (!template?.prompt) return 'No prompt available';
                                
                                if (typeof template.prompt === 'string') {
                                  return template.prompt;
                                }
                                
                                return template.prompt.prompt;
                              })()}
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
                  <Select
                    value={step.persona_id || 'none'}
                    onValueChange={(value) => handlePersonaChange(index, value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select persona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {personas.map((persona) => (
                        <SelectItem key={persona.id} value={persona.id}>
                          {persona.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select
                    value={step.chat_model_id || 'none'}
                    onValueChange={(value) => handleModelChange(index, value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {chatModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                              {chatModels.find(m => m.id === step.chat_model_id)?.description || 'No description available'}
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
            <Trash2 className="h-4 w-4" />
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
