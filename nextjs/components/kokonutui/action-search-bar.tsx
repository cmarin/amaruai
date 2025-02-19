"use client";

import { useState, useEffect } from "react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "cmdk";
import useDebounce from "@/hooks/use-debounce";
import { Persona } from "@/utils/persona-service";

interface Props {
  personas?: Persona[];
  defaultOpen?: boolean;
  onPersonaSelect?: (persona: Persona) => void;
}

export default function ActionSearchBar({
  defaultOpen = false,
  personas = [],
  onPersonaSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Persona[]>([]);
  const [isFocused, setIsFocused] = useState(defaultOpen);

  useEffect(() => {
    if (!isFocused) {
      setResult([]);
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const filteredPersonas = personas.filter(persona => {
      return persona.role.toLowerCase().includes(normalizedQuery);
    });

    setResult(filteredPersonas);
  }, [query, isFocused, personas]);

  return (
    <div className="w-full">
      <Command className="rounded-lg border shadow-md bg-background">
        <CommandInput
          placeholder="Search personas..."
          value={query}
          onValueChange={setQuery}
          className="h-9 border-none focus:ring-0 focus-visible:ring-0"
        />
        <CommandList className="max-h-[300px] overflow-auto">
          <CommandEmpty className="py-6 text-sm text-muted-foreground">
            No personas found.
          </CommandEmpty>
          <CommandGroup>
            {result.map((persona) => (
              <CommandItem
                key={persona.id}
                value={persona.role}
                className="flex items-center gap-3 px-4 py-3 text-sm cursor-pointer aria-selected:bg-accent"
                onSelect={() => onPersonaSelect?.(persona)}
              >
                {persona.avatar ? (
                  <div 
                    className="w-5 h-5 flex-shrink-0" 
                    dangerouslySetInnerHTML={{ __html: persona.avatar }} 
                  />
                ) : null}
                <span className="font-medium truncate">{persona.role}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
