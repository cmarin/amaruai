"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons"
import { Persona } from "@/utils/persona-service"

interface ComboboxPersonasProps {
  personas: Persona[]
  value?: string | number | null
  onSelect: (persona: Persona) => void
}

export function ComboboxPersonas({ personas, value, onSelect }: ComboboxPersonasProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const selectedPersona = personas.find(p => p.id.toString() === value?.toString())

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button 
        variant="outline" 
        role="combobox" 
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="w-full justify-between"
      >
        <span>{selectedPersona ? selectedPersona.role : "Select persona..."}</span>
        <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      <DialogContent className="p-0">
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
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedPersona?.id === persona.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {persona.role}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
