'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings, AlertCircle } from 'lucide-react';
import { PromptTemplate, VariableType } from '@/utils/prompt-template-service';
import { WizardStepProps } from '@/types/workflow-wizard';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ComplexPromptStepProps extends WizardStepProps {
  promptTemplate?: PromptTemplate;
}

export function ComplexPromptStep({
  workflow,
  wizardState,
  onStateChange,
  onNext,
  onPrevious,
  isFirst,
  isLast,
  promptTemplate
}: ComplexPromptStepProps) {
  const [values, setValues] = useState<{ [key: string]: string | string[] | number }>({});
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!promptTemplate?.is_complex) return;

    let content;
    if (typeof promptTemplate.prompt === 'string') {
      try {
        content = JSON.parse(promptTemplate.prompt);
      } catch (error) {
        console.error('Failed to parse prompt content');
        return;
      }
    } else if (typeof promptTemplate.prompt === 'object') {
      content = promptTemplate.prompt;
    } else {
      console.error('Prompt content is not a valid type');
      return;
    }

    if (!content?.variables) return;

    // Initialize values with preselected options
    const initialValues: { [key: string]: string | string[] | number } = {};
    content.variables.forEach((variable: VariableType) => {
      if (variable.preselectedOption) {
        initialValues[variable.fieldName] = variable.preselectedOption;
      }
    });
    setValues(initialValues);
  }, [promptTemplate]);

  // Generate prompt whenever values change
  useEffect(() => {
    generatePrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, promptTemplate]);

  const handleInputChange = useCallback((fieldName: string, value: string | string[] | number) => {
    if (value === '' || (Array.isArray(value) && value.length === 0)) {
      const newValues = { ...values };
      delete newValues[fieldName];
      setValues(newValues);
    } else {
      setValues(prev => ({ ...prev, [fieldName]: value }));
    }
  }, [values]);

  const generatePrompt = useCallback(() => {
    if (!promptTemplate?.is_complex) return;

    let content;
    if (typeof promptTemplate.prompt === 'string') {
      try {
        content = JSON.parse(promptTemplate.prompt);
      } catch (error) {
        return;
      }
    } else if (typeof promptTemplate.prompt === 'object') {
      content = promptTemplate.prompt;
    } else {
      return;
    }

    if (!content?.variables) return;

    let generated = content.prompt;
    const errors: string[] = [];

    content.variables.forEach((variable: VariableType) => {
      const value = values[variable.fieldName];
      if (value !== undefined && value !== '') {
        const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
        generated = generated.replace(new RegExp(`\\{${variable.fieldName}\\}`, 'g'), stringValue);
      } else {
        if (variable.required) {
          errors.push(`${variable.fieldName} is required`);
        }
        // Remove the placeholder for empty values
        generated = generated.replace(new RegExp(`\\{${variable.fieldName}\\}`, 'g'), '');
      }
    });

    // Trim any extra spaces
    generated = generated.replace(/\s+/g, ' ').trim();
    
    setGeneratedPrompt(generated);
    setValidationErrors(errors);

    // Update wizard state
    onStateChange({
      complexPromptData: errors.length === 0 ? generated : undefined
    });
  }, [values, promptTemplate, onStateChange]);

  const handleNext = useCallback(() => {
    if (validationErrors.length === 0 && generatedPrompt) {
      onNext();
    }
  }, [validationErrors, generatedPrompt, onNext]);

  if (!promptTemplate?.is_complex) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-8 w-8 text-yellow-500 mb-2" />
        <p className="text-gray-600">This step should only be shown for complex prompts.</p>
      </div>
    );
  }

  let content;
  try {
    content = typeof promptTemplate.prompt === 'string' 
      ? JSON.parse(promptTemplate.prompt) 
      : promptTemplate.prompt;
  } catch (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <p className="text-gray-600">Failed to parse prompt configuration.</p>
      </div>
    );
  }

  if (!content?.variables) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-8 w-8 text-yellow-500 mb-2" />
        <p className="text-gray-600">No variables found in prompt configuration.</p>
      </div>
    );
  }

  const renderField = (variable: VariableType) => {
    const value = values[variable.fieldName] || '';
    const hasError = variable.required && (value === '' || value === undefined);

    const fieldElement = (() => {
      switch (variable.controlType) {
        case 'select':
          return (
            <Select
              value={String(value)}
              onValueChange={(newValue) => handleInputChange(variable.fieldName, newValue)}
            >
              <SelectTrigger className={cn(hasError && "border-red-500")}>
                <SelectValue placeholder={variable.placeholder || "Select an option"} />
              </SelectTrigger>
              <SelectContent>
                {variable.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );

        case 'multiselect':
          return (
            <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
              {variable.options?.map((option) => {
                const currentValues = Array.isArray(value) ? value : [];
                const isSelected = currentValues.includes(option);
                
                return (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${variable.fieldName}-${option}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const newValues = checked
                          ? [...currentValues, option]
                          : currentValues.filter(v => v !== option);
                        handleInputChange(variable.fieldName, newValues);
                      }}
                    />
                    <Label
                      htmlFor={`${variable.fieldName}-${option}`}
                      className="text-sm cursor-pointer"
                    >
                      {option}
                    </Label>
                  </div>
                );
              })}
            </div>
          );

        case 'textarea':
          return (
            <Textarea
              value={String(value)}
              onChange={(e) => handleInputChange(variable.fieldName, e.target.value)}
              placeholder={variable.placeholder}
              className={cn(hasError && "border-red-500")}
              rows={4}
            />
          );

        case 'number':
          return (
            <Input
              type="number"
              value={String(value)}
              onChange={(e) => handleInputChange(variable.fieldName, parseFloat(e.target.value) || 0)}
              placeholder={variable.placeholder}
              className={cn(hasError && "border-red-500")}
              min={variable.validation?.min}
              max={variable.validation?.max}
              step={variable.validation?.step}
            />
          );

        default:
          return (
            <Input
              type="text"
              value={String(value)}
              onChange={(e) => handleInputChange(variable.fieldName, e.target.value)}
              placeholder={variable.placeholder}
              className={cn(hasError && "border-red-500")}
            />
          );
      }
    })();

    return (
      <div key={variable.fieldName} className="space-y-2">
        <div className="flex items-center space-x-2">
          <Label htmlFor={variable.fieldName} className="text-sm font-medium">
            {variable.fieldName}
            {variable.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {variable.tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="h-4 w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{variable.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {fieldElement}
        {hasError && (
          <p className="text-xs text-red-500">{variable.fieldName} is required</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Configure Prompt</h2>
        <p className="text-gray-600">
          Fill out the form below to customize your prompt. Required fields are marked with *.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Fields */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Prompt Variables</h3>
          <ScrollArea className="h-[400px] border rounded-lg p-4">
            <div className="space-y-4">
              {content.variables.map(renderField)}
            </div>
          </ScrollArea>
        </div>

        {/* Generated Prompt Preview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Preview</h3>
          <div className="border rounded-lg p-4 h-[400px] overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
            {generatedPrompt ? (
              <div className="whitespace-pre-wrap text-sm">
                {generatedPrompt}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">
                Fill out the form to see your generated prompt
              </div>
            )}
          </div>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</h4>
          <ul className="text-sm text-red-700 list-disc list-inside">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={isFirst}
          className="min-w-[100px]"
        >
          Previous
        </Button>
        <div className="flex space-x-2">
          <Button
            onClick={handleNext}
            disabled={validationErrors.length > 0 || !generatedPrompt}
            className="min-w-[100px]"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}