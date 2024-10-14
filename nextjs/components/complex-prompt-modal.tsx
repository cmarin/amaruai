// complex-prompt-modal.tsx

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PromptTemplate, VariableType } from './promptTemplateService';

type ComplexPromptModalProps = {
  prompt: PromptTemplate;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (generatedPrompt: string) => void;
};

export function ComplexPromptModal({ prompt, isOpen, onClose, onSubmit }: ComplexPromptModalProps) {
  const [values, setValues] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    console.log('Prompt object:', prompt);

    if (!prompt.is_complex) {
      console.error('Prompt is not complex. This component should only be used for complex prompts.');
      return;
    }

    const content = prompt.content;
    if (!content) {
      console.error(`No content found in prompt object for prompt ID ${prompt.id}.`);
      return;
    }

    // Initialize values with preselected options
    const initialValues: { [key: string]: string } = {};
    content.variables.forEach((variable: VariableType) => {
      if (variable.preselectedOption) {
        initialValues[variable.fieldName] = variable.preselectedOption;
      }
    });
    setValues(initialValues);
  }, [prompt]);

  const handleInputChange = (fieldName: string, value: string) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = () => {
    if (!prompt.is_complex) {
      console.error('Prompt is not complex. This component should only be used for complex prompts.');
      return;
    }

    const content = prompt.content;
    if (!content) {
      console.error(`No content found in prompt object for prompt ID ${prompt.id}.`);
      return;
    }

    let generatedPrompt = content.prompt;
    content.variables.forEach((variable: VariableType) => {
      const value = values[variable.fieldName] || '';
      generatedPrompt = generatedPrompt.replace(`{${variable.fieldName}}`, value);
    });
    onSubmit(generatedPrompt);
    onClose();
  };

  if (!prompt || !prompt.is_complex || !prompt.content) {
    return null;
  }

  const content = prompt.content;

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
                <label htmlFor={variable.fieldName} className="text-right text-black"> {/* Add text-black class */}
                  {variable.fieldName}
                </label>
                {variable.controlType === 'textarea' ? (
                  <Textarea
                    id={variable.fieldName}
                    placeholder={variable.placeholder}
                    className="col-span-3 bg-white text-black border-gray-300"
                    required={variable.required}
                    value={values[variable.fieldName] || ''}
                    onChange={(e) => handleInputChange(variable.fieldName, e.target.value)}
                  />
                ) : variable.controlType === 'dropdown' ? (
                  <Select
                    value={values[variable.fieldName]}
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
                ) : (
                  <Input
                    id={variable.fieldName}
                    placeholder={variable.placeholder}
                    className="col-span-3 bg-white text-black border-gray-300"
                    required={variable.required}
                    value={values[variable.fieldName] || ''}
                    onChange={(e) => handleInputChange(variable.fieldName, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">Done</Button> {/* Add explicit button styling */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
