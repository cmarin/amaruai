"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { SunIcon, MoonIcon } from "@radix-ui/react-icons"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button 
      variant="outline" 
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="relative"
    >
      <SunIcon className="h-[1.2rem] w-[1.2rem] transition-all dark:scale-0 dark:opacity-0" />
      <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] transition-all scale-0 opacity-0 dark:scale-100 dark:opacity-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
} 