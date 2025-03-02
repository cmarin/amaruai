'use client';

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface GeneratingButtonProps {
  isGenerating: boolean;
}

export function GeneratingButton({ isGenerating }: GeneratingButtonProps) {
  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b dark:border-gray-800 p-2 flex justify-center">
      <Button 
        variant="outline" 
        size="sm" 
        className="text-muted-foreground dark:text-gray-300 dark:border-gray-700" 
        disabled
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isGenerating ? "Generating..." : "Generated"}
      </Button>
    </div>
  );
}
