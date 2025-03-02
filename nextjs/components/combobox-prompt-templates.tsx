"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons"
import type { PromptTemplateOption } from "@/types"
import { fetchPromptTemplates } from "@/utils/prompt-template-service"
import { useSession } from "@/app/utils/session/session"

interface ComboboxPromptTemplatesProps {
  templates: PromptTemplateOption[]
  value?: string | number | null
  onSelect: (template: PromptTemplateOption | null) => void
}

export function ComboboxPromptTemplates({ templates, value, onSelect }: ComboboxPromptTemplatesProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isSearching, setIsSearching] = React.useState(false)
  const [allTemplates, setAllTemplates] = React.useState<PromptTemplateOption[]>(templates)
  const { getApiHeaders } = useSession()
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  
  // Keep track of the last selected template to prevent flicker
  const [lastSelectedTemplate, setLastSelectedTemplate] = React.useState<PromptTemplateOption | null>(null)
  
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
    
    // Update lastSelectedTemplate when we have a valid template
    if (found) {
      setLastSelectedTemplate(found);
    }
    
    // Initialize allTemplates with the provided templates
    setAllTemplates(templates);
  }, [templates, value, valueString]);

  // Handle search input change with debounce
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Only search if query is at least 2 characters
    if (value.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchTemplates(value);
      }, 300);
    }
  };
  
  // Search prompt templates from API
  const searchTemplates = async (query: string) => {
    if (!query || query.length < 2) return;
    
    const headers = await getApiHeaders();
    if (!headers) return;
    
    setIsSearching(true);
    try {
      const searchResults = await fetchPromptTemplates(headers, {
        query: query,
        limit: 30,
        sort_by: 'title',
        sort_order: 'asc'
      });
      
      // Merge with existing templates, prioritizing the searched ones
      // Create a map of template IDs to prevent duplicates
      const templateMap = new Map<string, PromptTemplateOption>();
      
      // First add all search results
      searchResults.forEach(template => {
        templateMap.set(template.id.toString(), template as PromptTemplateOption);
      });
      
      // Then add any templates from the original list that aren't already in the map
      templates.forEach(template => {
        if (!templateMap.has(template.id.toString())) {
          templateMap.set(template.id.toString(), template);
        }
      });
      
      setAllTemplates(Array.from(templateMap.values()));
    } catch (error) {
      console.error('Error searching prompt templates:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Find the selected template
  const selectedTemplate = React.useMemo(() => {
    // First try to find by value
    const found = allTemplates.find(t => t.id.toString() === valueString);
    
    // If not found but we have a lastSelectedTemplate and the value is null,
    // this might be a temporary state update - use the last known template
    const result = found || (valueString === null && lastSelectedTemplate) || null;
    
    console.log('Recalculated selected template:', result?.title || null);
    return result;
  }, [allTemplates, valueString, lastSelectedTemplate]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

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
            onValueChange={handleSearchChange}
            className="h-9" 
          />
          <CommandList>
            {isSearching ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching templates...
              </div>
            ) : (
              <>
                <CommandEmpty>No template found.</CommandEmpty>
                <CommandGroup>
                  {allTemplates
                    .filter(template => 
                      template.title.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((template) => (
                      <CommandItem
                        key={template.id}
                        value={template.title}
                        onSelect={() => {
                          console.log('Template selected in ComboboxPromptTemplates:', template);
                          
                          // Save this as the last selected template
                          setLastSelectedTemplate(template);
                          
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
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
