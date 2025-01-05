'use client';

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ReviewStepProps {
  customInstructions: string;
  onInstructionsChange: (value: string) => void;
  onPrevious: () => void;
  onExecute: () => void;
}

export function ReviewStep({
  customInstructions,
  onInstructionsChange,
  onPrevious,
  onExecute,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          Custom Instructions (Optional)
        </label>
        <Textarea
          className="min-h-[100px] w-full"
          placeholder="Add any custom instructions for processing..."
          value={customInstructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
        />
      </div>

      <div className="flex justify-between mt-4">
        <Button 
          variant="outline" 
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button 
          variant="outline"
          onClick={onExecute}
        >
          Execute
        </Button>
      </div>
    </div>
  );
}
