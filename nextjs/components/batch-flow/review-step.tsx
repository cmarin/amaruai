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
    <form 
      className="space-y-6 max-w-5xl mx-auto" 
      onSubmit={(e) => {
        e.preventDefault();
        onExecute();
      }}
    >
      <div className="w-full">
        <label className="block text-sm font-medium mb-2">
          Custom Instructions (Optional)
        </label>
        <Textarea
          className="min-h-[200px] w-full"
          placeholder="Add any custom instructions for processing..."
          value={customInstructions}
          onChange={(e) => {
            e.preventDefault();
            onInstructionsChange(e.target.value);
          }}
        />
      </div>

      <div className="flex justify-between mt-4">
        <Button 
          variant="outline"
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onPrevious();
          }}
        >
          Previous
        </Button>
        <Button 
          variant="outline"
          type="submit"
        >
          Execute
        </Button>
      </div>
    </form>
  );
}
