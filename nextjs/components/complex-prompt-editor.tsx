'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { Category } from '../utils/category-service'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import TagSelector from './tag-selector';
import { Tag } from '../utils/tag-service'
import { useData } from '@/components/data-context'
import { Persona } from '@/utils/persona-service'
import { ChatModel } from '@/utils/chat-model-service';
import { ComboboxPersonas } from './combobox-personas';
import { ComboboxChatModels } from './combobox-chat-models';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';

type NumberValidation = {
  min?: number;
  max?: number;
  step?: number;
  errorMessage?: string;
}

type DateValidation = {
  min?: string;
  max?: string;
  errorMessage?: string;
}

type Validation = NumberValidation | DateValidation;

type Variable = {
  fieldName: string;
  required: boolean;
  controlType: string;
  placeholder?: string;
  options?: string[];
  preselectedOption?: string | string[];
  tooltip?: string;
  defaultValue?: number | string;
  validation?: Validation;
}

export type PromptContent = {
  variables: Variable[]
  prompt: string
}

type VariableFieldValue =
  | string
  | boolean
  | string[]
  | number
  | Partial<NumberValidation>
  | Partial<DateValidation>
  | undefined;

export interface ComplexPromptEditorProps {
  title?: string;
  initialContent?: PromptContent;
  categories: Category[];
  selectedCategory?: string;
  selectedTags?: Tag[];
  defaultPersonaId?: string | null;
  defaultChatModelId?: string | null;
  onSave: (title: string, category: string, tags: Tag[], data: PromptContent, defaultPersonaId: string | null, defaultChatModelId: string | null) => void;
  onCancel: () => void;
  isSaving?: boolean;
  mode?: 'create' | 'edit';
  sidebarOpen?: boolean;
}

const ComplexPromptEditor = ({ 
  title = '',
  initialContent,
  categories,
  selectedCategory = '',
  selectedTags = [],
  defaultPersonaId = null,
  defaultChatModelId = null,
  onSave,
  onCancel,
  isSaving = false,
  mode = 'edit',
  sidebarOpen = false
}: ComplexPromptEditorProps) => {
  const [promptContent, setPromptContent] = useState<PromptContent>({
    variables: [],
    prompt: ""
  })
  const [currentTitle, setCurrentTitle] = useState(title)
  const [currentCategory, setCurrentCategory] = useState(selectedCategory)
  const [tags, setTags] = useState<Tag[]>(selectedTags || [])
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(defaultPersonaId);
  const [selectedChatModelId, setSelectedChatModelId] = useState<string | null>(defaultChatModelId);
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("visual")
  const [currentStep, setCurrentStep] = useState(1)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const { personas, chatModels } = useData();
  const { sidebarOpen: useSidebarSidebarOpen } = useSidebar();

  useEffect(() => {
    if (initialContent) {
      let parsedData: PromptContent;
      if (typeof initialContent === 'string') {
        try {
          parsedData = JSON.parse(initialContent);
        } catch (error) {
          console.error('Error parsing initialData:', error);
          parsedData = { variables: [], prompt: initialContent };
        }
      } else {
        parsedData = initialContent;
      }
      setPromptContent({
        variables: Array.isArray(parsedData.variables) ? parsedData.variables : [],
        prompt: parsedData.prompt || ""
      });
    }
    setCurrentTitle(title)
    setCurrentCategory(selectedCategory)
    setTags(selectedTags || [])
  }, [initialContent, title, selectedCategory, selectedTags])

  const handleAddVariable = () => {
    setPromptContent(prev => ({
      ...prev,
      variables: [...prev.variables, {
        fieldName: "",
        required: false,
        controlType: "text"
      }]
    }))
  }

  const handleVariableChange = (index: number, field: keyof Variable, value: VariableFieldValue) => {
    setPromptContent(prev => ({
      ...prev,
      variables: prev.variables.map((v, i) => {
        if (i === index) {
          if (field === 'validation') {
            const newValidation: Validation | undefined = 
              typeof value === 'object' && value !== null
                ? v.controlType === 'number'
                  ? { ...v.validation as NumberValidation, ...value as Partial<NumberValidation> }
                  : v.controlType === 'date'
                  ? { ...v.validation as DateValidation, ...value as Partial<DateValidation> }
                  : undefined
                : undefined;
            
            return { ...v, validation: newValidation };
          }
          return { ...v, [field]: value };
        }
        return v;
      })
    }));
  };

  const handlePromptChange = (value: string) => {
    setPromptContent(prev => ({
      ...prev,
      prompt: value
    }))
  }

  const handleJsonChange = useCallback((value: string) => {
    try {
      const parsed = JSON.parse(value)
      setPromptContent(parsed)
      setJsonError(null)
    } catch (error) {
      setJsonError("Invalid JSON")
    }
  }, [])

  const insertVariable = (variableName: string) => {
    const textarea = promptTextareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = textarea.value
      const before = text.substring(0, start)
      const after = text.substring(end, text.length)
      const newText = `${before}{${variableName}}${after}`
      setPromptContent(prev => ({ ...prev, prompt: newText }))
      
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variableName.length + 2
        textarea.focus()
      }, 0)
    }
  }

  const moveVariable = (index: number, direction: 'up' | 'down') => {
    setPromptContent(prev => {
      const newVariables = [...prev.variables];
      if (direction === 'up' && index > 0) {
        [newVariables[index - 1], newVariables[index]] = [newVariables[index], newVariables[index - 1]];
      } else if (direction === 'down' && index < newVariables.length - 1) {
        [newVariables[index], newVariables[index + 1]] = [newVariables[index + 1], newVariables[index]];
      }
      return { ...prev, variables: newVariables };
    });
  };

  const renderVariable = (variable: Variable, index: number) => {
    return (
      <Card key={index} className="mb-6 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-grow">
            <Input
              placeholder="Field Name"
              value={variable.fieldName}
              onChange={(e) => handleVariableChange(index, 'fieldName', e.target.value)}
            />
          </div>
          <div className="ml-4 flex items-center">
            <Select
              value={variable.controlType}
              onValueChange={(value) => handleVariableChange(index, 'controlType', value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Control Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="textarea">Textarea</SelectItem>
                <SelectItem value="dropdown">Dropdown</SelectItem>
                <SelectItem value="multiselect">Multiselect</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-2 flex flex-col">
              {index > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveVariable(index, 'up')}
                  className="h-8 w-8"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
              {index < promptContent.variables.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveVariable(index, 'down')}
                  className="h-8 w-8"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox
            id={`required-${index}`}
            checked={variable.required}
            onCheckedChange={(checked) => handleVariableChange(index, 'required', checked)}
          />
          <Label htmlFor={`required-${index}`}>Required</Label>
        </div>
        {(variable.controlType === 'dropdown' || variable.controlType === 'multiselect') && (
          <div className="space-y-4">
            <Input
              placeholder="Options (comma-separated)"
              value={variable.options?.join(', ') || ''}
              onChange={(e) => handleVariableChange(index, 'options', e.target.value.split(',').map(s => s.trim()))}
            />
            <Input
              placeholder="Preselected option"
              value={variable.preselectedOption as string || ''}
              onChange={(e) => handleVariableChange(index, 'preselectedOption', e.target.value)}
            />
          </div>
        )}
        {variable.controlType === 'number' && (
          <div className="space-y-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    type="number"
                    placeholder="Default Value"
                    value={variable.defaultValue?.toString() || ''}
                    onChange={(e) => handleVariableChange(index, 'defaultValue', parseInt(e.target.value, 10))}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Default value for this number field</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="grid grid-cols-3 gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={(variable.validation as NumberValidation)?.min?.toString() || ''}
                      onChange={(e) => handleVariableChange(index, 'validation', { min: parseInt(e.target.value, 10) })}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Minimum allowed value</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={(variable.validation as NumberValidation)?.max?.toString() || ''}
                      onChange={(e) => handleVariableChange(index, 'validation', { max: parseInt(e.target.value, 10) })}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Maximum allowed value</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      type="number"
                      placeholder="Step"
                      value={(variable.validation as NumberValidation)?.step?.toString() || ''}
                      onChange={(e) => handleVariableChange(index, 'validation', { step: parseInt(e.target.value, 10) })}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Step size for incrementing/decrementing</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}
        {variable.controlType === 'date' && (
          <div className="space-y-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    type="date"
                    placeholder="Default Value"
                    value={variable.defaultValue as string || ''}
                    onChange={(e) => handleVariableChange(index, 'defaultValue', e.target.value)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Default date for this field</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Input
                placeholder="Error Message"
                value={(variable.validation as Validation)?.errorMessage || ''}
                onChange={(e) => handleVariableChange(index, 'validation', { errorMessage: e.target.value })}
                className="mt-4"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>Error message to display when validation fails</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Input
                placeholder="Tooltip"
                value={variable.tooltip || ''}
                onChange={(e) => handleVariableChange(index, 'tooltip', e.target.value)}
                className="mt-4"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>Tooltip to display for this variable</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Card>
    )
  }

  const handleTitleChange = (value: string) => {
    setCurrentTitle(value)
  }

  const handleCategoryChange = (value: string) => {
    setCurrentCategory(value)
  }

  const handleSave = () => {
    onSave(currentTitle, currentCategory, tags, promptContent, selectedPersonaId, selectedChatModelId);
  }

  const renderStepIndicator = () => {
    return (
      <div className="flex items-center justify-between mb-8 pt-4">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className="flex items-center"
            onClick={() => setCurrentStep(step)}
            style={{ cursor: 'pointer' }}
          >
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${currentStep === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}
              ${currentStep > step ? 'bg-green-500 text-white' : ''}
            `}>
              {step}
            </div>
            <div className={`ml-2 ${currentStep === step ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
              {step === 1 ? 'Metadata' : 
               step === 2 ? 'Persona & Model' : 
               step === 3 ? 'Form' : 'Prompt'}
            </div>
            {step < 4 && (
              <div className="mx-4 flex-grow border-t border-gray-300 w-20" />
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="title" className="w-24">
                  Title
                </Label>
                <Input
                  id="title"
                  value={currentTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="flex-grow"
                />
              </div>
              <div className="flex items-center gap-4">
                <Label htmlFor="category" className="w-24">
                  Category
                </Label>
                <Select
                  value={currentCategory}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tags</Label>
                <TagSelector
                  tags={tags}
                  setTags={setTags}
                  placeholder="Add tags"
                />
              </div>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Default Persona</Label>
                <ComboboxPersonas
                  personas={personas || []}
                  value={selectedPersonaId || undefined}
                  onSelect={(persona: Persona) => setSelectedPersonaId(persona.id.toString())}
                />
              </div>
              <div>
                <Label>Default Chat Model</Label>
                <ComboboxChatModels
                  models={chatModels || []}
                  value={selectedChatModelId}
                  onSelect={(model: ChatModel) => setSelectedChatModelId(model.id)}
                />
              </div>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <Label>Form Fields</Label>
                <Button onClick={handleAddVariable} className="bg-blue-500 hover:bg-blue-600 text-white">Add Field</Button>
              </div>
              {(promptContent.variables || []).map((variable, index) => renderVariable(variable, index))}
            </div>
          </div>
        )
      case 4:
        return (
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="visual">Visual Editor</TabsTrigger>
                <TabsTrigger value="json">JSON Editor</TabsTrigger>
              </TabsList>
              <TabsContent value="visual" className="mt-4">
                <div>
                  <Label className="mb-2 block">Prompt Template</Label>
                  <Textarea
                    ref={promptTextareaRef}
                    placeholder="Enter your prompt template here. Use {VariableName} for placeholders."
                    value={promptContent.prompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    className="min-h-[100px] mb-2"
                  />
                  <Select onValueChange={insertVariable}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Insert Variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {(promptContent.variables || []).map((v, index) => (
                        <SelectItem key={index} value={v.fieldName || `variable-${index}`}>
                          {v.fieldName || `Variable ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              <TabsContent value="json" className="mt-4">
                <CodeMirror
                  value={JSON.stringify(promptContent, null, 2)}
                  height="400px"
                  extensions={[json()]}
                  onChange={handleJsonChange}
                  theme={vscodeDark}
                  className="border border-gray-300 rounded-md"
                />
                {jsonError && (
                  <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                    {jsonError}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )
      default:
        return null
    }
  }

  const renderNavigation = () => {
    return (
      <div className="flex justify-between mt-8">
        {currentStep > 1 && (
          <Button
            onClick={() => setCurrentStep(prev => prev - 1)}
            variant="outline"
            className="flex items-center"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
        )}
        <div className="flex-grow" />
        {currentStep < 4 && (
          <Button
            onClick={() => setCurrentStep(prev => prev + 1)}
            variant="outline"
            className="flex items-center"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <div className="flex h-screen">
        <AppSidebar />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${useSidebarSidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="flex items-center justify-between p-4 border-b bg-white">
            <h1 className="text-2xl font-bold">Prompt Template Editor</h1>
            <div className="flex gap-2">
              <Button onClick={onCancel} variant="outline">Close</Button>
              <Button 
                onClick={handleSave} 
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save
              </Button>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h2 className="text-gray-600 text-lg text-center">
              {currentTitle || 'Untitled Prompt'}
            </h2>
          </div>
          <div className="flex-grow overflow-auto bg-white">
            <CardContent className="pt-8">
              {renderStepIndicator()}
              {renderStepContent()}
              {renderNavigation()}
            </CardContent>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ComplexPromptEditor;
