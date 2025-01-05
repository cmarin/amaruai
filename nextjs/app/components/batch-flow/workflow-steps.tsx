'use client';

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BatchFlowStep } from "@/types";

interface WorkflowStepsProps {
  steps: BatchFlowStep[];
  onUpdateStep: (index: number, field: keyof BatchFlowStep, value: string) => void;
  onRemoveStep: (index: number) => void;
  onAddStep: () => void;
  promptTemplates: Array<{ id: string; title: string }>;
  chatModels: Array<{ id: string; name: string }>;
  personas: Array<{ id: string; role: string }>;
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
                <Select
                  value={step.prompt_template_id}
                  onValueChange={(value) => onUpdateStep(index, 'prompt_template_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select prompt" />
                  </SelectTrigger>
                  <SelectContent>
                    {promptTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Chat Model</label>
                <Select
                  value={step.chat_model_id}
                  onValueChange={(value) => onUpdateStep(index, 'chat_model_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
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
                <label className="block text-sm font-medium mb-2">Persona</label>
                <Select
                  value={step.persona_id}
                  onValueChange={(value) => onUpdateStep(index, 'persona_id', value)}
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
