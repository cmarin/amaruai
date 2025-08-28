'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Database, Settings, Play } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { WizardStepProps } from '@/types/workflow-wizard';

type ReviewStepProps = WizardStepProps;

export function ReviewStep({
  workflow,
  wizardState,
  onStateChange,
  onNext,
  onPrevious,
  onComplete,
  isFirst,
  isLast
}: ReviewStepProps) {
  const hasUploadedFiles = wizardState.uploadedFiles.length > 0;
  const hasSelectedAssets = wizardState.selectedAssets.length > 0;
  const hasSelectedKBs = wizardState.selectedKnowledgeBases.length > 0;
  const hasComplexPrompt = Boolean(wizardState.complexPromptData);

  const handleExecute = () => {
    // Mark the wizard as ready for execution
    onStateChange({ isExecuting: true });
    onComplete();
  };

  return (
    <div className="space-y-6">
      

      {/* Workflow Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Workflow Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Name</p>
              <p className="text-sm">{workflow.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Process Type</p>
              <Badge variant="secondary">{workflow.process_type}</Badge>
            </div>
          </div>
          {workflow.description && (
            <div>
              <p className="text-sm font-medium text-gray-600">Description</p>
              <p className="text-sm text-gray-700">{workflow.description}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-600">Steps</p>
            <p className="text-sm">{workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}</p>
          </div>
        </CardContent>
      </Card>

      {/* Selected Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uploaded Files */}
        {(hasUploadedFiles || workflow.allow_file_upload) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Uploaded Files</span>
                <Badge variant="outline">{wizardState.uploadedFiles.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasUploadedFiles ? (
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {wizardState.uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <span className="text-sm truncate">{file.name}</span>
                        </div>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {file.size > 1024 * 1024
                            ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
                            : (file.size / 1024).toFixed(1) + ' KB'}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-gray-500">No files uploaded</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Selected Assets and Knowledge Bases */}
        {(hasSelectedAssets || hasSelectedKBs || workflow.allow_asset_selection) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Selected Resources</span>
                <Badge variant="outline">
                  {wizardState.selectedAssets.length + wizardState.selectedKnowledgeBases.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(hasSelectedAssets || hasSelectedKBs) ? (
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {wizardState.selectedAssets.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">
                          Assets ({wizardState.selectedAssets.length})
                        </p>
                        {wizardState.selectedAssets.map((assetId) => (
                          <div key={assetId} className="flex items-center space-x-2 p-1">
                            <FileText className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-700">Asset {assetId}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {wizardState.selectedKnowledgeBases.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">
                          Knowledge Bases ({wizardState.selectedKnowledgeBases.length})
                        </p>
                        {wizardState.selectedKnowledgeBases.map((kbId) => (
                          <div key={kbId} className="flex items-center space-x-2 p-1">
                            <Database className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-700">KB {kbId}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-gray-500">No resources selected</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Complex Prompt Preview */}
      {hasComplexPrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Generated Prompt</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[120px]">
              {(() => {
                const promptText = wizardState.complexPromptData || '';
                const label = 'Referenced Content:';
                const lcPrompt = promptText.toLowerCase();
                const labelIndex = lcPrompt.indexOf(label.toLowerCase());

                let mainPrompt = promptText;
                let referencedContent: string | null = null;

                if (labelIndex !== -1) {
                  const before = promptText.slice(0, labelIndex).trimEnd();
                  const afterLabelIndex = labelIndex + label.length;
                  const rest = promptText.slice(afterLabelIndex);

                  const trimmedRest = rest.replace(/^\s+/, '');

                  let ref = '';
                  let remainder = '';

                  if (trimmedRest.startsWith('```')) {
                    const afterTicks = trimmedRest.slice(3);
                    const endTicks = afterTicks.indexOf('```');
                    if (endTicks !== -1) {
                      ref = afterTicks.slice(0, endTicks).trim();
                      remainder = afterTicks.slice(endTicks + 3).replace(/^\n+/, '');
                    } else {
                      ref = afterTicks.trim();
                      remainder = '';
                    }
                  } else {
                    const doubleNewline = trimmedRest.search(/\n\s*\n/);
                    if (doubleNewline !== -1) {
                      ref = trimmedRest.slice(0, doubleNewline).trim();
                      remainder = trimmedRest.slice(doubleNewline).replace(/^\n+/, '');
                    } else {
                      const nl = trimmedRest.indexOf('\n');
                      if (nl !== -1) {
                        ref = trimmedRest.slice(0, nl).trim();
                        remainder = trimmedRest.slice(nl + 1);
                      } else {
                        ref = trimmedRest.trim();
                        remainder = '';
                      }
                    }
                  }

                  mainPrompt = [before, remainder].filter(Boolean).join('\n').trim();
                  referencedContent = ref.length ? ref : null;
                }

                return (
                  <div className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    {referencedContent ? (
                      <>
                        {mainPrompt && (
                          <div className="whitespace-pre-wrap">
                            <ReactMarkdown>{mainPrompt}</ReactMarkdown>
                          </div>
                        )}
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-gray-600 dark:text-gray-300">
                            Referenced Content (click to expand)
                          </summary>
                          <div className="mt-2 whitespace-pre-wrap">
                            <ReactMarkdown>{referencedContent}</ReactMarkdown>
                          </div>
                        </details>
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap">
                        <ReactMarkdown>{promptText}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })()}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{wizardState.uploadedFiles.length}</p>
              <p className="text-xs text-gray-600">Files</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {wizardState.selectedAssets.length + wizardState.selectedKnowledgeBases.length}
              </p>
              <p className="text-xs text-gray-600">Resources</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{workflow.steps.length}</p>
              <p className="text-xs text-gray-600">Steps</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 flex justify-between pt-3 border-t bg-background dark:bg-gray-900">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={isFirst}
          className="min-w-[100px]"
        >
          Previous
        </Button>
        <div className="flex space-x-2">
          <Button
            onClick={handleExecute}
            disabled={wizardState.isExecuting}
            className="min-w-[120px] bg-green-600 hover:bg-green-700"
          >
            <Play className="mr-2 h-4 w-4" />
            {wizardState.isExecuting ? 'Executing...' : 'Execute Workflow'}
          </Button>
        </div>
      </div>
    </div>
  );
}