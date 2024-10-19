"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Workflow, WorkflowStep, createWorkflow, updateWorkflow } from './workflowService'
import { PromptTemplate, fetchPromptTemplates } from './promptTemplateService'
import { ChatModel, fetchChatModels } from './chatModelService'
import { Persona, fetchPersonas } from './personaService'

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
  })
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([])
  const [chatModels, setChatModels] = useState<ChatModel[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])

  useEffect(() => {
    if (initialWorkflow) {
      setWorkflow(initialWorkflow)
    }
  }, [initialWorkflow])

  useEffect(() => {
    const fetchData = async () => {
      const [fetchedPromptTemplates, fetchedChatModels, fetchedPersonas] = await Promise.all([
        fetchPromptTemplates(),
        fetchChatModels(),
        fetchPersonas()
      ])
      setPromptTemplates(fetchedPromptTemplates)
      setChatModels(fetchedChatModels)
      setPersonas(fetchedPersonas)
    }
    fetchData()
  }, [])

  const addStep = () => {
    const newStep: WorkflowStep = {
      prompt_template_id: promptTemplates[0]?.id.toString() || "",
      chat_model_id: chatModels[0]?.id.toString() || "",
      persona_id: personas[0]?.id.toString() || "",
      order: workflow.steps.length,
    }
    setWorkflow({ ...workflow, steps: [...workflow.steps, newStep] })
  }

  const removeStep = (index: number) => {
    setWorkflow({
      ...workflow,
      steps: workflow.steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, order: i })),
    })
  }

  const updateStep = (index: number, field: keyof WorkflowStep, value: string) => {
    setWorkflow({
      ...workflow,
      steps: workflow.steps.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
    })
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...workflow.steps];
    if (direction === 'up' && index > 0) {
      [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    } else if (direction === 'down' && index < newSteps.length - 1) {
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    }
    setWorkflow({ ...workflow, steps: newSteps.map((step, i) => ({ ...step, order: i })) });
  };

  const handleSave = async () => {
    try {
      console.log('Saving workflow:', workflow);
      if (workflow.id) {
        const updatedWorkflow = await updateWorkflow(workflow.id, {
          name: workflow.name,
          description: workflow.description,
          process_type: workflow.process_type,
          steps: workflow.steps
        });
        setWorkflow(updatedWorkflow);
      } else {
        const createdWorkflow = await createWorkflow(workflow);
        setWorkflow(createdWorkflow);
      }
      console.log('Workflow saved successfully');
      onSave();
    } catch (error) {
      console.error('Error saving workflow:', error);
      // Handle error (e.g., show error message to user)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={workflow.name}
                onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
                placeholder="Workflow Name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={workflow.description}
                onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
                placeholder="Workflow Description"
              />
            </div>
            <div>
              <Label htmlFor="processType">Process Type</Label>
              <Select
                value={workflow.process_type}
                onValueChange={(value: "SEQUENTIAL" | "HIERARCHICAL") =>
                  setWorkflow({ ...workflow, process_type: value })
                }
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
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflow.steps.map((step, index) => (
              <div key={index} className="border p-4 rounded-md bg-muted mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Step {index + 1}</h3>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === workflow.steps.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => removeStep(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Select
                    value={step.prompt_template_id?.toString()}
                    onValueChange={(value) => updateStep(index, "prompt_template_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select prompt template" />
                    </SelectTrigger>
                    <SelectContent>
                      {promptTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={step.chat_model_id?.toString()}
                    onValueChange={(value) => updateStep(index, "chat_model_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select chat model" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatModels.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={step.persona_id?.toString()}
                    onValueChange={(value) => updateStep(index, "persona_id", value)}
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
            ))}
          </div>
          <Button onClick={addStep} className="mt-4 bg-blue-500 hover:bg-blue-600 text-white">
            <Plus className="mr-2 h-4 w-4" /> Add Step
          </Button>
        </CardContent>
      </Card>
      <div className="flex justify-end space-x-4 mt-4">
        <Button onClick={onCancel} variant="outline">Cancel</Button>
        <Button onClick={handleSave} className="bg-green-500 hover:bg-green-600 text-white">
          Save Workflow
        </Button>
      </div>
    </div>
  )
}
