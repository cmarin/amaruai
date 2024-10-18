"use client"

import { useState } from "react"
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Mock data for dropdowns
const promptTemplates = ["Template 1", "Template 2", "Template 3"]
const chatModels = ["GPT-3", "GPT-4", "Claude"]
const personas = ["Customer Support", "Technical Expert", "Sales Representative"]

interface WorkflowStep {
  id: string
  promptTemplate: string
  chatModel: string
  persona: string
  order: number
}

interface Workflow {
  name: string
  description: string
  processType: "SEQUENTIAL" | "HIERARCHICAL"
  steps: WorkflowStep[]
}

export function WorkflowManagerComponent() {
  const [workflow, setWorkflow] = useState<Workflow>({
    name: "",
    description: "",
    processType: "SEQUENTIAL",
    steps: [],
  })

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: Date.now().toString(),
      promptTemplate: promptTemplates[0],
      chatModel: chatModels[0],
      persona: personas[0],
      order: workflow.steps.length,
    }
    setWorkflow({ ...workflow, steps: [...workflow.steps, newStep] })
  }

  const removeStep = (id: string) => {
    setWorkflow({
      ...workflow,
      steps: workflow.steps.filter((step) => step.id !== id).map((step, index) => ({ ...step, order: index })),
    })
  }

  const updateStep = (id: string, field: keyof WorkflowStep, value: string) => {
    setWorkflow({
      ...workflow,
      steps: workflow.steps.map((step) => (step.id === id ? { ...step, [field]: value } : step)),
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
                value={workflow.processType}
                onValueChange={(value: "SEQUENTIAL" | "HIERARCHICAL") =>
                  setWorkflow({ ...workflow, processType: value })
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
              <div key={step.id} className="border p-4 rounded-md bg-muted mb-4">
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
                    <Button variant="destructive" size="icon" onClick={() => removeStep(step.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Select
                    value={step.promptTemplate}
                    onValueChange={(value) => updateStep(step.id, "promptTemplate", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select prompt template" />
                    </SelectTrigger>
                    <SelectContent>
                      {promptTemplates.map((template) => (
                        <SelectItem key={template} value={template}>
                          {template}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={step.chatModel}
                    onValueChange={(value) => updateStep(step.id, "chatModel", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select chat model" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={step.persona}
                    onValueChange={(value) => updateStep(step.id, "persona", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select persona" />
                    </SelectTrigger>
                    <SelectContent>
                      {personas.map((persona) => (
                        <SelectItem key={persona} value={persona}>
                          {persona}
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
    </div>
  )
}