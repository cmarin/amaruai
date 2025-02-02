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
import { EyeIcon } from "lucide-react";
import type { BatchFlowStep } from "@/types";
import type { PromptTemplateOption, ChatModelOption, PersonaOption } from "@/types";

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
                    onValueChange={(value) => onUpdateStep(index, 'prompt_template_id', value)}
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
                        <TooltipContent>
                          <pre className="max-w-xs whitespace-pre-wrap">
                            {JSON.stringify(promptTemplates.find(t => t.id === step.prompt_template_id), null, 2)}
                          </pre>
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
                    value={step.chat_model_id}
                    onValueChange={(value) => onUpdateStep(index, 'chat_model_id', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
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
                        <TooltipContent>
                          <pre className="max-w-xs whitespace-pre-wrap">
                            {JSON.stringify(chatModels.find(m => m.id === step.chat_model_id), null, 2)}
                          </pre>
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
                    value={step.persona_id}
                    onValueChange={(value) => onUpdateStep(index, 'persona_id', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select persona" />
                    </SelectTrigger>
                    <SelectContent>
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
                        <TooltipContent>
                          <p className="max-w-xs">
                            Role: {personas.find(p => p.id === step.persona_id)?.role || 'No role defined'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={() => onRemoveStep(index)}
            disabled={steps.length === 1}
          >
            Remove
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
