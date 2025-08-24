'use client';

import { WizardStepConfig, WizardStepId } from '@/types/workflow-wizard';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardProgressProps {
  steps: WizardStepConfig[];
  currentStepId: WizardStepId;
  completedSteps: Set<string>;
}

export function WizardProgress({ steps, currentStepId, completedSteps }: WizardProgressProps) {
  if (steps.length === 0) return null;

  return (
    <div className="w-full mb-8">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = step.id === currentStepId;
          const isUpcoming = !isCompleted && !isCurrent;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    {
                      'bg-blue-500 text-white': isCurrent,
                      'bg-green-500 text-white': isCompleted,
                      'border-2 border-gray-300 text-gray-500': isUpcoming
                    }
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                
                {/* Step label */}
                <div className="ml-3 min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      {
                        'text-blue-600': isCurrent,
                        'text-green-600': isCompleted,
                        'text-gray-500': isUpcoming
                      }
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-500 mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden sm:block flex-1 mx-6">
                  <div
                    className={cn(
                      'h-0.5 transition-colors',
                      {
                        'bg-blue-500': completedSteps.has(step.id),
                        'bg-gray-300': !completedSteps.has(step.id)
                      }
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar for mobile */}
      <div className="sm:hidden">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((steps.findIndex(s => s.id === currentStepId) + 1) / steps.length) * 100}%`
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Step {steps.findIndex(s => s.id === currentStepId) + 1}</span>
          <span>{steps.length} Steps</span>
        </div>
      </div>
    </div>
  );
}