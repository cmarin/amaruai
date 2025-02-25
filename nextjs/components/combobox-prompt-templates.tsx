"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons"
import type { PromptTemplateOption } from "@/types"

interface ComboboxPromptTemplatesProps {
  templates: PromptTemplateOption[]
  value?: string | number | null
  onSelect: (template: PromptTemplateOption | null) => void
}

export function ComboboxPromptTemplates({ templates, value, onSelect }: ComboboxPromptTemplatesProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  
  // Convert value to string for comparison
  const valueString = value ? value.toString() : null;

  // Debug the incoming value and available templates
  React.useEffect(() => {
    console.log('ComboboxPromptTemplates props:', { value, valueString, templatesCount: templates.length });
    const found = templates.find(t => t.id.toString() === valueString);
    console.log('SelectedTemplate:', found);
    if (valueString && !found) {
      console.warn('Template with ID', value, 'not found in available templates');
    }
  }, [templates, value, valueString]);

  // Find the selected template
  const selectedTemplate = React.useMemo(() => {
    const found = templates.find(t => t.id.toString() === valueString);
    console.log('Recalculated selected template:', found?.title || null);
    return found;
  }, [templates, valueString]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button 
        variant="outline" 
        role="combobox" 
        aria-expanded={open}
        onClick={() => {
          console.log('Opening template dialog with value:', value);
          console.log('Selected template before opening:', selectedTemplate);
          setOpen(true);
        }}
        className="w-full justify-between"
      >
        <span>{selectedTemplate ? selectedTemplate.title : "Select template..."}</span>
        <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      <DialogContent className="p-0">
        <Command>
          <CommandInput 
            placeholder="Search templates..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9" 
          />
          <CommandList>
            <CommandEmpty>No template found.</CommandEmpty>
            <CommandGroup>
              {templates
                .filter(template => 
                  template.title.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((template) => (
                  <CommandItem
                    key={template.id}
                    value={template.title}
                    onSelect={() => {
                      console.log('Template selected in ComboboxPromptTemplates:', template);
                      
                      // Explicitly compare the template ID with the current value
                      if (template.id.toString() === valueString) {
                        console.log('Template already selected - forcing re-selection');
                        // Force a re-selection to ensure UI updates
                        onSelect(null); // Clear first
                        setTimeout(() => {
                          onSelect(template); // Then set again
                        }, 50);
                      } else {
                        onSelect(template);
                      }
                      
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4",
                        valueString === template.id.toString() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {template.title}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
