"use client"

import { ThemeToggle } from "./theme-toggle"

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-2">
          {/* Your logo or brand here */}
          <h1 className="text-xl font-bold">AmaruAI</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Additional header elements like navigation links */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
} 