'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Asset } from '@/types/knowledge-base';
import { KnowledgeBaseSelection } from '@/types/workflow';
import { fetchKnowledgeBase } from '@/utils/knowledge-base-service';
import { useSession } from '@/app/utils/session/session';
import { useToast } from "@/hooks/use-toast";
import { WizardStepProps } from '@/types/workflow-wizard';
import { derror } from '@/utils/debug';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

type IndividualAssetSelectionStepProps = WizardStepProps;

interface KnowledgeBaseAssets {
  [knowledgeBaseId: string]: Asset[];
}

export function IndividualAssetSelectionStep({
  workflow,
  wizardState,
  onStateChange,
  onNext,
  onPrevious,
  isFirst,
  isLast
}: IndividualAssetSelectionStepProps) {
  const [kbAssets, setKbAssets] = useState<KnowledgeBaseAssets>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const { getApiHeaders } = useSession();
  const { toast } = useToast();

  const assetSelectionConfig = workflow.asset_selection_config;

  const loadKnowledgeBaseAssets = useCallback(async () => {
    if (!assetSelectionConfig?.knowledge_base_selections.length) return;

    try {
      setIsLoading(true);
      const headers = getApiHeaders();
      if (!headers) return;

      const assetsData: KnowledgeBaseAssets = {};
      
      // Fetch assets for each configured knowledge base
      await Promise.all(
        assetSelectionConfig.knowledge_base_selections.map(async (selection) => {
          try {
            const kb = await fetchKnowledgeBase(selection.knowledge_base_id, headers);
            assetsData[selection.knowledge_base_id] = kb.assets || [];
          } catch (error) {
            derror(`Error loading assets for KB ${selection.knowledge_base_id}:`, error);
          }
        })
      );

      setKbAssets(assetsData);
    } catch (error) {
      derror('Error loading knowledge base assets:', error);
      toast({
        title: "Error",
        description: "Failed to load assets from knowledge bases",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [assetSelectionConfig, getApiHeaders, toast]);

  // Load assets when component mounts
  useEffect(() => {
    loadKnowledgeBaseAssets();
  }, [loadKnowledgeBaseAssets]);

  const handleSingleSelection = useCallback((kbId: string, assetId: string | undefined) => {
    const currentSelections = { ...wizardState.individualAssetSelections };
    
    if (assetId) {
      currentSelections[kbId] = [assetId];
    } else {
      delete currentSelections[kbId];
    }
    
    onStateChange({ individualAssetSelections: currentSelections });
  }, [wizardState.individualAssetSelections, onStateChange]);

  const handleMultipleSelection = useCallback((kbId: string, assetId: string, isSelected: boolean) => {
    const currentSelections = { ...wizardState.individualAssetSelections };
    const currentKbSelections = currentSelections[kbId] || [];
    
    if (isSelected) {
      // Add if not already present
      if (!currentKbSelections.includes(assetId)) {
        currentSelections[kbId] = [...currentKbSelections, assetId];
      }
    } else {
      // Remove if present
      currentSelections[kbId] = currentKbSelections.filter(id => id !== assetId);
      if (currentSelections[kbId].length === 0) {
        delete currentSelections[kbId];
      }
    }
    
    onStateChange({ individualAssetSelections: currentSelections });
  }, [wizardState.individualAssetSelections, onStateChange]);

  const removeSelection = useCallback((kbId: string, assetId: string) => {
    const currentSelections = { ...wizardState.individualAssetSelections };
    const currentKbSelections = currentSelections[kbId] || [];
    
    currentSelections[kbId] = currentKbSelections.filter(id => id !== assetId);
    if (currentSelections[kbId].length === 0) {
      delete currentSelections[kbId];
    }
    
    onStateChange({ individualAssetSelections: currentSelections });
  }, [wizardState.individualAssetSelections, onStateChange]);

  const getFilteredAssets = useCallback((kbId: string): Asset[] => {
    const assets = kbAssets[kbId] || [];
    const searchTerm = searchTerms[kbId]?.toLowerCase() || '';
    
    if (!searchTerm) return assets;
    
    return assets.filter(asset => 
      asset.title?.toLowerCase().includes(searchTerm) ||
      asset.file_name?.toLowerCase().includes(searchTerm)
    );
  }, [kbAssets, searchTerms]);

  const isSelectionValid = useCallback((selection: KnowledgeBaseSelection): boolean => {
    const currentSelections = wizardState.individualAssetSelections[selection.knowledge_base_id] || [];
    
    if (selection.required && currentSelections.length === 0) {
      return false;
    }
    
    if (selection.selection_type === 'multiple' && selection.max_selections) {
      return currentSelections.length <= selection.max_selections;
    }
    
    return true;
  }, [wizardState.individualAssetSelections]);

  const canProceed = useCallback((): boolean => {
    if (!assetSelectionConfig?.knowledge_base_selections.length) return true;
    
    return assetSelectionConfig.knowledge_base_selections.every(selection => 
      isSelectionValid(selection)
    );
  }, [assetSelectionConfig, isSelectionValid]);

  if (!assetSelectionConfig?.knowledge_base_selections.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No individual asset selection configured for this workflow.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading assets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Content area with extra bottom padding to accommodate sticky footer */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 pb-24">
        <div className="space-y-8">
          {assetSelectionConfig.knowledge_base_selections.map((selection) => {
            const assets = getFilteredAssets(selection.knowledge_base_id);
            const currentSelections = wizardState.individualAssetSelections[selection.knowledge_base_id] || [];
            const isValid = isSelectionValid(selection);

            return (
              <div key={selection.knowledge_base_id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">
                      {selection.label}
                      {selection.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {selection.selection_type === 'multiple' && selection.max_selections && (
                      <p className="text-xs text-gray-500 mt-1">
                        Select up to {selection.max_selections} items ({currentSelections.length}/{selection.max_selections})
                      </p>
                    )}
                  </div>
                  {!isValid && (
                    <Badge variant="destructive" className="text-xs">
                      {selection.required ? 'Required' : 'Limit exceeded'}
                    </Badge>
                  )}
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={`Search ${selection.label.toLowerCase()}...`}
                    value={searchTerms[selection.knowledge_base_id] || ''}
                    onChange={(e) => setSearchTerms(prev => ({
                      ...prev,
                      [selection.knowledge_base_id]: e.target.value
                    }))}
                    className="pl-10"
                  />
                </div>

                {/* Selected items display for multiple selection */}
                {selection.selection_type === 'multiple' && currentSelections.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {currentSelections.map(assetId => {
                      const asset = assets.find(a => a.id === assetId);
                      return asset ? (
                        <Badge key={assetId} variant="secondary" className="flex items-center gap-1">
                          <span className="truncate max-w-32">{asset.title || asset.file_name}</span>
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-red-500" 
                            onClick={() => removeSelection(selection.knowledge_base_id, assetId)}
                          />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Asset selection UI */}
                {selection.selection_type === 'single' ? (
                  <Select 
                    value={currentSelections[0] || ''} 
                    onValueChange={(value) => handleSingleSelection(selection.knowledge_base_id, value || undefined)}
                  >
                    <SelectTrigger className={`${!isValid ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder={`Select ${selection.label.toLowerCase()}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.length > 0 ? (
                        assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <span className="truncate">{asset.title || asset.file_name}</span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-assets" disabled>
                          No assets found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <ScrollArea className="h-64 border rounded-lg p-4">
                    {assets.length > 0 ? (
                      <div className="space-y-2">
                        {assets.map((asset) => {
                          const isSelected = currentSelections.includes(asset.id);
                          const isDisabled = !isSelected && 
                            !!selection.max_selections && 
                            currentSelections.length >= selection.max_selections;
                          
                          return (
                            <div
                              key={asset.id}
                              className={`flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer ${
                                isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              onClick={() => !isDisabled && handleMultipleSelection(selection.knowledge_base_id, asset.id, !isSelected)}
                            >
                              <Checkbox
                                id={`asset-${asset.id}`}
                                checked={isSelected}
                                disabled={isDisabled}
                                onCheckedChange={(checked) => 
                                  !isDisabled && handleMultipleSelection(selection.knowledge_base_id, asset.id, checked === true)
                                }
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                                    <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                    <span className="text-sm font-medium truncate">
                                      {asset.title || asset.file_name}
                                    </span>
                                  </div>
                                  {asset.size && (
                                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                      {(asset.size / 1024).toFixed(1)} KB
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="mx-auto h-8 w-8 mb-2" />
                        <p>No assets found</p>
                      </div>
                    )}
                  </ScrollArea>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky footer with solid background to avoid overlap */}
      <div className="sticky bottom-0 z-20 flex justify-between pt-3 border-t bg-white dark:bg-gray-900">
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
            variant="outline"
            onClick={onNext}
            disabled={!canProceed()}
            className="min-w-[100px]"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}