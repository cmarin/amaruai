"use client"

import * as React from "react"
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChatModel } from "@/components/data-context"

interface ComboboxChatModelsProps {
  models: ChatModel[]
  value?: string | null
  onSelect: (model: ChatModel) => void
}

export function ComboboxChatModels({
  models = [],
  value = null,
  onSelect,
}: ComboboxChatModelsProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedModel = React.useMemo(() => 
    models.find(model => model?.id === value) || null
  , [models, value])

  const filteredModels = React.useMemo(() => {
    if (!search) return models
    const searchLower = search.toLowerCase()
    return models.filter(model => 
      (model?.name || '').toLowerCase().includes(searchLower) || 
      (model?.provider || '').toLowerCase().includes(searchLower)
    )
  }, [models, search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open} 
          className="w-full justify-between"
        >
          <span>{selectedModel?.name || "Select model..."}</span>
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput 
            placeholder="Search models..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>No model found.</CommandEmpty>
          <CommandGroup>
            {filteredModels.map((model) => (
              <CommandItem
                key={model.id}
                value={model.name || ''}
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
        </Command>
      </PopoverContent>
    </Popover>
  )
}
