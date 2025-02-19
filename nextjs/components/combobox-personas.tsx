"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CheckIcon, CaretSortIcon } from "@radix-ui/react-icons"
import { Persona } from "@/utils/persona-service"

interface ComboboxPersonasProps {
  personas: Persona[]
  value?: string | number
  onSelect: (persona: Persona) => void
}

export function ComboboxPersonas({ personas, value, onSelect }: ComboboxPersonasProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const selectedPersona = personas.find(p => p.id.toString() === value?.toString())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open} 
          className="w-full justify-between"
        >
          <span>{selectedPersona ? selectedPersona.role : "Select persona..."}</span>
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput 
            placeholder="Search personas..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9" 
          />
          <CommandList>
            <CommandEmpty>No persona found.</CommandEmpty>
            <CommandGroup>
              {personas
                .filter(persona => 
                  persona.role.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((persona) => (
                  <CommandItem
                    key={persona.id}
                    value={persona.role}
                    onSelect={() => {
                      onSelect(persona)
                      setOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <span>{persona.role}</span>
                    <CheckIcon 
                      className={cn(
                        "ml-auto h-4 w-4", 
                        value?.toString() === persona.id.toString() ? "opacity-100" : "opacity-0"
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
