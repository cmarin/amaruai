"use client";

import { useState, useEffect } from "react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import useDebounce from "@/hooks/use-debounce";
import { Persona } from "@/utils/persona-service";

interface Action {
    id: string | number;
    label: string;
    icon: React.ReactNode;
    description?: string;
    short?: string;
    end?: string;
    persona?: Persona;
}

interface SearchResult {
    actions: Action[];
}

const allActionsSample: Action[] = [
    {
        id: "1",
        label: "Book tickets",
        icon: <div className="w-5 h-5" />,
        description: "Operator",
        short: "⌘K",
        end: "Agent",
    },
    {
        id: "2",
        label: "Summarize",
        icon: <div className="w-5 h-5" />,
        description: "gpt-4o",
        short: "⌘cmd+p",
        end: "Command",
    },
    {
        id: "3",
        label: "Screen Studio",
        icon: <div className="w-5 h-5" />,
        description: "gpt-4o",
        short: "",
        end: "Application",
    },
    {
        id: "4",
        label: "Talk to Jarvis",
        icon: <div className="w-5 h-5" />,
        description: "gpt-4o voice",
        short: "",
        end: "Active",
    },
    {
        id: "5",
        label: "Kokonut UI - Pro",
        icon: <div className="w-5 h-5" />,
        description: "Components",
        short: "",
        end: "Link",
    },
];

interface Props {
    actions?: Action[];
    defaultOpen?: boolean;
    onPersonaSelect?: (persona: Persona) => void;
    personas?: Persona[];
}

export default function ActionSearchBar({
    actions = allActionsSample,
    defaultOpen = false,
    onPersonaSelect,
    personas = [],
}: Props) {
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<SearchResult | null>(null);
    const [isFocused, setIsFocused] = useState(defaultOpen);

    useEffect(() => {
        if (!isFocused) {
            setResult(null);
            return;
        }

        const normalizedQuery = query.toLowerCase().trim();
        const filteredPersonas = personas
            .filter((persona) => {
                return persona.role.toLowerCase().includes(normalizedQuery);
            })
            .map((persona) => ({
                id: persona.id,
                label: persona.role,
                icon: persona.avatar ? (
                    <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: persona.avatar }} />
                ) : null,
                persona: persona,
            }));

        setResult({ actions: filteredPersonas });
    }, [query, isFocused, personas]);

    return (
        <div className="w-full">
            <Command className="rounded-lg border shadow-md">
                <CommandInput
                    placeholder="Search personas..."
                    value={query}
                    onValueChange={setQuery}
                    className="h-9"
                />
                <CommandList className="max-h-[300px] overflow-auto">
                    <CommandEmpty>No personas found.</CommandEmpty>
                    <CommandGroup>
                        {result?.actions.map((action) => (
                            <CommandItem
                                key={action.id}
                                value={action.label}
                                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent cursor-pointer"
                                onSelect={() => {
                                    if (action.persona && onPersonaSelect) {
                                        onPersonaSelect(action.persona);
                                    }
                                }}
                            >
                                {action.icon}
                                <span className="font-medium">{action.label}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
        </div>
    );
}
