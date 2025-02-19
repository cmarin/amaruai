"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CheckIcon, CaretSortIcon } from "@radix-ui/react-icons"
import { ChatModel } from "@/components/data-context"

interface ComboboxChatModelsProps {
  models: ChatModel[]
  value?: string | null
  onSelect: (model: ChatModel) => void
}

export function ComboboxChatModels({ models, value, onSelect }: ComboboxChatModelsProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const selectedModel = models.find(m => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open} 
          className="w-full justify-between"
        >
          <span>{selectedModel ? selectedModel.name : "Select model..."}</span>
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[var(--radix-popover-trigger-width)] p-0" align="start" style={{ zIndex: 100 }}>
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
                      onSelect(model)
                      setOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <span>{model.name}</span>
                    <CheckIcon 
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === model.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
