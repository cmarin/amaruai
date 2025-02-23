"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { AlignLeft, List, CheckSquare, Hash, Calendar, Type } from "lucide-react"

export type VariableType = "text" | "textarea" | "dropdown" | "multiselect" | "number" | "date"

interface VariableButtonBarProps {
  onAddVariable: (type: VariableType) => void
}

export function VariableButtonBar({ onAddVariable }: VariableButtonBarProps) {
  const buttons: { type: VariableType; icon: React.ReactNode; label: string }[] = [
    { type: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
    { type: "textarea", icon: <AlignLeft className="h-4 w-4" />, label: "Textarea" },
    { type: "dropdown", icon: <List className="h-4 w-4" />, label: "Dropdown" },
    { type: "multiselect", icon: <CheckSquare className="h-4 w-4" />, label: "Multiselect" },
    { type: "number", icon: <Hash className="h-4 w-4" />, label: "Number" },
    { type: "date", icon: <Calendar className="h-4 w-4" />, label: "Date" },
  ]

  return (
    <div className="flex flex-wrap gap-2 p-2 bg-secondary rounded-lg">
      {buttons.map((button) => (
        <Button
          key={button.type}
          variant="outline"
          size="sm"
          onClick={() => onAddVariable(button.type)}
          className="flex items-center gap-2"
        >
          {button.icon}
          <span className="hidden sm:inline">{button.label}</span>
          <span className="sr-only">{`Add ${button.label} field`}</span>
        </Button>
      ))}
    </div>
  )
}
