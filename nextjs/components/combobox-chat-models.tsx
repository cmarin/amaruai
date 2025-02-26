"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons"
import { ChatModel } from "@/components/data-context"

interface ComboboxChatModelsProps {
  models: ChatModel[]
  value?: string | number | null
  onSelect: (model: ChatModel) => void
}

export function ComboboxChatModels({ models, value, onSelect }: ComboboxChatModelsProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Debug the incoming value and available models
  React.useEffect(() => {
    console.log('ComboboxChatModels props:', { value, modelsCount: models.length });
    const found = models.find(m => m.id.toString() === value?.toString());
    console.log('Selected model:', found);
    if (value && !found) {
      console.warn('Model with ID', value, 'not found in available models');
    }
  }, [models, value]);

  // Find the selected model
  const selectedModel = React.useMemo(() => {
    return models.find(m => m.id.toString() === value?.toString());
  }, [models, value]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button 
        variant="outline" 
        role="combobox" 
        aria-expanded={open}
        onClick={() => {
          console.log('Opening model dialog with value:', value);
          console.log('Selected model before opening:', selectedModel);
          setOpen(true);
        }}
        className="w-full justify-between"
      >
        <span>{selectedModel ? selectedModel.name : "Select model..."}</span>
        <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      <DialogContent className="p-0">
        <Command>
          <CommandInput 
            placeholder="Search models..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9" 
          />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models
                .filter(model => 
                  model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  model.provider.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.name}
                    onSelect={() => {
                      console.log('Model selected in ComboboxChatModels:', model);
                      onSelect(model);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <span>{model.name}</span>
                    <CheckIcon
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedModel?.id === model.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
