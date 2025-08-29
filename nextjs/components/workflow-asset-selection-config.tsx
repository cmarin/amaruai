'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Database } from 'lucide-react';
import { KnowledgeBase } from '@/utils/knowledge-base-service';
import { AssetSelectionConfig, KnowledgeBaseSelection } from '@/types/workflow';
import { v4 as uuidv4 } from 'uuid';

interface WorkflowAssetSelectionConfigProps {
  knowledgeBases: KnowledgeBase[];
  config: AssetSelectionConfig | undefined;
  onChange: (config: AssetSelectionConfig | undefined) => void;
}

export function WorkflowAssetSelectionConfig({
  knowledgeBases,
  config,
  onChange
}: WorkflowAssetSelectionConfigProps) {
  const [selections, setSelections] = useState<KnowledgeBaseSelection[]>(
    config?.knowledge_base_selections || []
  );

  useEffect(() => {
    if (selections.length === 0) {
      onChange(undefined);
    } else {
      onChange({
        knowledge_base_selections: selections
      });
    }
  }, [selections]);

  const addSelection = () => {
    const newSelection: KnowledgeBaseSelection = {
      knowledge_base_id: '',
      selection_type: 'single',
      required: false,
      label: ''
    };
    setSelections([...selections, newSelection]);
  };

  const removeSelection = (index: number) => {
    setSelections(selections.filter((_, i) => i !== index));
  };

  const updateSelection = (index: number, updates: Partial<KnowledgeBaseSelection>) => {
    const updated = [...selections];
    updated[index] = { ...updated[index], ...updates };
    
    // Clear max_selections if switching to single
    if (updates.selection_type === 'single') {
      delete updated[index].max_selections;
    }
    // Set default max_selections if switching to multiple
    else if (updates.selection_type === 'multiple' && !updated[index].max_selections) {
      updated[index].max_selections = 5;
    }
    
    setSelections(updated);
  };

  const getAvailableKnowledgeBases = (currentKbId?: string) => {
    const usedKbIds = selections
      .map(s => s.knowledge_base_id)
      .filter(id => id && id !== currentKbId);
    
    return knowledgeBases.filter(kb => !usedKbIds.includes(kb.id));
  };

  const getKnowledgeBaseName = (kbId: string) => {
    const kb = knowledgeBases.find(k => k.id === kbId);
    return kb?.title || 'Unknown';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Individual Asset Selection Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          Configure which knowledge bases users can select individual assets from when running this workflow.
        </p>

        {selections.length === 0 ? (
          <div className="text-center py-4 border-2 border-dashed rounded-lg">
            <Database className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 mb-3">
              No individual asset selections configured
            </p>
            <Button onClick={addSelection} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Selection
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {selections.map((selection, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  {/* Knowledge Base Selection */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Knowledge Base</Label>
                      <Select
                        value={selection.knowledge_base_id}
                        onValueChange={(value) => updateSelection(index, { knowledge_base_id: value })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select knowledge base" />
                        </SelectTrigger>
                        <SelectContent>
                          {selection.knowledge_base_id && (
                            <SelectItem value={selection.knowledge_base_id}>
                              {getKnowledgeBaseName(selection.knowledge_base_id)} (current)
                            </SelectItem>
                          )}
                          {getAvailableKnowledgeBases(selection.knowledge_base_id).map((kb) => (
                            <SelectItem key={kb.id} value={kb.id}>
                              {kb.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Selection Type</Label>
                      <Select
                        value={selection.selection_type}
                        onValueChange={(value: 'single' | 'multiple') => 
                          updateSelection(index, { selection_type: value })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single Selection</SelectItem>
                          <SelectItem value="multiple">Multiple Selection</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Label and Max Selections */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Label</Label>
                      <Input
                        placeholder="e.g., Select Message Template"
                        value={selection.label}
                        onChange={(e) => updateSelection(index, { label: e.target.value })}
                        className="h-9"
                      />
                    </div>

                    {selection.selection_type === 'multiple' && (
                      <div>
                        <Label className="text-xs">Max Selections</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="e.g., 5"
                          value={selection.max_selections || ''}
                          onChange={(e) => updateSelection(index, { 
                            max_selections: parseInt(e.target.value) || undefined 
                          })}
                          className="h-9"
                        />
                      </div>
                    )}
                  </div>

                  {/* Required Checkbox and Delete Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`required-${index}`}
                        checked={selection.required}
                        onCheckedChange={(checked) => 
                          updateSelection(index, { required: checked === true })
                        }
                      />
                      <Label 
                        htmlFor={`required-${index}`} 
                        className="text-sm cursor-pointer"
                      >
                        Required selection
                      </Label>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSelection(index)}
                      className="h-8 px-2 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            <Button 
              onClick={addSelection} 
              variant="outline" 
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Another Selection
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}