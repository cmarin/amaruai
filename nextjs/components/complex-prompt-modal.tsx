// complex-prompt-modal.tsx

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PromptTemplate, VariableType } from './prompt-template-service';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type ComplexPromptModalProps = {
  prompt: PromptTemplate;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (generatedPrompt: string) => void;
};

export function ComplexPromptModal({ prompt, isOpen, onClose, onSubmit }: ComplexPromptModalProps) {
  const [values, setValues] = useState<{ [key: string]: string | string[] | number }>({});

  useEffect(() => {
    console.log('Prompt object:', prompt);

    if (!prompt.is_complex) {
      console.error('Prompt is not complex. This component should only be used for complex prompts.');
      return;
    }

    let content;
    if (typeof prompt.prompt === 'string') {
      try {
        content = JSON.parse(prompt.prompt);
      } catch (error) {
        console.error(`Failed to parse prompt content for prompt ID ${prompt.id}.`, error);
        return;
      }
    } else if (typeof prompt.prompt === 'object') {
      content = prompt.prompt; // Directly use the object if it's already parsed
    } else {
      console.error(`Prompt content is not a valid type for prompt ID ${prompt.id}.`);
      return;
    }

    if (!content || !content.variables) {
      console.error(`No valid content found in prompt object for prompt ID ${prompt.id}.`);
      return;
    }

    // Initialize values with preselected options
    const initialValues: { [key: string]: string | string[] | number } = {};
    content.variables.forEach((variable: VariableType) => {
      if (variable.preselectedOption) {
        initialValues[variable.fieldName] = variable.preselectedOption;
      }
    });
    setValues(initialValues);
  }, [prompt]);

  const handleInputChange = (fieldName: string, value: string | string[] | number) => {
    if (value === '' || (Array.isArray(value) && value.length === 0)) {
      // Remove empty values from the state
      const newValues = { ...values };
      delete newValues[fieldName];
      setValues(newValues);
    } else {
      setValues(prev => ({ ...prev, [fieldName]: value }));
    }
  };

  const handleSubmit = () => {
    let content;
    if (typeof prompt.prompt === 'string') {
      try {
        content = JSON.parse(prompt.prompt);
      } catch (error) {
        console.error('Invalid prompt or content');
        return;
      }
    } else if (typeof prompt.prompt === 'object') {
      content = prompt.prompt;
    } else {
      console.error('Prompt content is not a valid type');
      return;
    }

    if (!content || !content.variables) {
      console.error('Invalid content structure');
      return;
    }

    let generatedPrompt = content.prompt;
    content.variables.forEach((variable: VariableType) => {
      const value = values[variable.fieldName];
      if (value !== undefined && value !== '') {
        const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
        generatedPrompt = generatedPrompt.replace(new RegExp(`\\{${variable.fieldName}\\}`, 'g'), stringValue);
      } else {
        // Remove the placeholder for empty values
        generatedPrompt = generatedPrompt.replace(new RegExp(`\\{${variable.fieldName}\\}`, 'g'), '');
      }
    });
    
    // Trim any extra spaces that might have been left after removing empty placeholders
    generatedPrompt = generatedPrompt.replace(/\s+/g, ' ').trim();
    
    onSubmit(generatedPrompt);
    onClose();
  };

  if (!prompt || !prompt.is_complex) {
    return null;
  }

  let content;
  if (typeof prompt.prompt === 'string') {
    try {
      content = JSON.parse(prompt.prompt);
    } catch (error) {
      console.error('Failed to parse prompt content');
      return null;
    }
  } else if (typeof prompt.prompt === 'object') {
    content = prompt.prompt;
  } else {
    console.error('Prompt content is not a valid type');
    return null;
  }

  if (!content || !content.variables) {
    console.error('Invalid content structure');
    return null;
  }

  const renderField = (variable: VariableType) => {
    const commonProps = {
      id: variable.fieldName,
      placeholder: variable.placeholder,
      className: "col-span-3 bg-white text-black border-gray-300",
      required: variable.required,
      value: values[variable.fieldName] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        handleInputChange(variable.fieldName, e.target.value),
    };

    switch (variable.controlType) {
      case 'textarea':
        return <Textarea {...commonProps} />;
      case 'dropdown':
        return (
          <Select
            value={values[variable.fieldName] as string}
            onValueChange={(value) => handleInputChange(variable.fieldName, value)}
          >
            <SelectTrigger className="col-span-3 bg-white text-black border-gray-300">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent className="bg-white text-black">
              {variable.options?.map((option: string) => (
                <SelectItem key={option} value={option} className="text-black">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'multiselect':
        return (
          <div className="col-span-3 space-y-2">
            {variable.options?.map((option: string) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${variable.fieldName}-${option}`}
                  checked={(values[variable.fieldName] as string[] || []).includes(option)}
                  onCheckedChange={(checked) => {
                    const currentValues = values[variable.fieldName] as string[] || [];
                    const newValues = checked
                      ? [...currentValues, option]
                      : currentValues.filter(v => v !== option);
                    handleInputChange(variable.fieldName, newValues);
                  }}
                />
                <Label htmlFor={`${variable.fieldName}-${option}`}>{option}</Label>
              </div>
            ))}
          </div>
        );
      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            min={variable.validation?.min}
            max={variable.validation?.max}
            step={variable.validation?.step}
          />
        );
      case 'date':
        return <Input {...commonProps} type="date" />;
      default:
        return <Input {...commonProps} />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white text-black">
        <DialogHeader>
          <DialogTitle className="text-black">{prompt.title || 'Default Title'}</DialogTitle>
          <DialogDescription>
            Fill in the required fields to generate your prompt.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="mt-8 max-h-[60vh]">
          <div className="grid gap-4 py-4">
            {content.variables.map((variable: VariableType) => (
              <div key={variable.fieldName} className="grid grid-cols-4 items-center gap-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor={variable.fieldName} className="text-right text-black">
                        {variable.fieldName}
                        {variable.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                    </TooltipTrigger>
                    {variable.tooltip && (
                      <TooltipContent>
                        <p>{variable.tooltip}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                {renderField(variable)}
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
