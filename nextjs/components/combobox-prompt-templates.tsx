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
  onSelect: (template: PromptTemplateOption) => void
}

export function ComboboxPromptTemplates({ templates, value, onSelect }: ComboboxPromptTemplatesProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Debug the incoming value and available templates
  React.useEffect(() => {
    console.log('ComboboxPromptTemplates props:', { value, templatesCount: templates.length });
    const found = templates.find(t => t.id.toString() === value?.toString());
    console.log('SelectedTemplate:', found);
    if (value && !found) {
      console.warn('Template with ID', value, 'not found in available templates');
    }
  }, [templates, value]);

  // Find the selected template
  const selectedTemplate = React.useMemo(() => {
    return templates.find(t => t.id.toString() === value?.toString());
  }, [templates, value]);

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
                      onSelect(template);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedTemplate?.id === template.id ? "opacity-100" : "opacity-0"
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
