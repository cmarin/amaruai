'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Database, Loader2, FolderOpen } from 'lucide-react';
import { Asset, KnowledgeBase } from '@/types/knowledge-base';
import { fetchAssets } from '@/utils/asset-service';
import { fetchKnowledgeBases } from '@/utils/knowledge-base-service';
import { useSession } from '@/app/utils/session/session';
import { useToast } from "@/hooks/use-toast";
import { WizardStepProps } from '@/types/workflow-wizard';
import { derror } from '@/utils/debug';

interface AssetSelectionStepProps extends WizardStepProps {}

export function AssetSelectionStep({
  workflow,
  wizardState,
  onStateChange,
  onNext,
  onPrevious,
  isFirst,
  isLast
}: AssetSelectionStepProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('assets');
  const { getApiHeaders } = useSession();
  const { toast } = useToast();

  // Load assets and knowledge bases
  useEffect(() => {
    loadAssetsAndKnowledgeBases();
  }, []);

  const loadAssetsAndKnowledgeBases = async () => {
    try {
      setIsLoading(true);
      const headers = getApiHeaders();
      if (!headers) return;

      const [assetsData, kbData] = await Promise.all([
        fetchAssets(headers),
        fetchKnowledgeBases(headers)
      ]);

      setAssets(assetsData);
      setKnowledgeBases(kbData);
    } catch (error) {
      derror('Error loading assets and knowledge bases:', error);
      toast({
        title: "Error",
        description: "Failed to load assets and knowledge bases",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAsset = useCallback((assetId: string) => {
    const currentAssets = wizardState.selectedAssets;
    const newAssets = currentAssets.includes(assetId)
      ? currentAssets.filter(id => id !== assetId)
      : [...currentAssets, assetId];
    
    onStateChange({ selectedAssets: newAssets });
  }, [wizardState.selectedAssets, onStateChange]);

  const toggleKnowledgeBase = useCallback((kbId: string) => {
    const currentKBs = wizardState.selectedKnowledgeBases;
    const newKBs = currentKBs.includes(kbId)
      ? currentKBs.filter(id => id !== kbId)
      : [...currentKBs, kbId];
    
    onStateChange({ selectedKnowledgeBases: newKBs });
  }, [wizardState.selectedKnowledgeBases, onStateChange]);

  const totalSelected = wizardState.selectedAssets.length + wizardState.selectedKnowledgeBases.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Select Resources</h2>
        <p className="text-gray-600">
          Choose assets and knowledge bases to include in your workflow execution.
          These resources will be made available to all workflow steps.
        </p>
        {totalSelected > 0 && (
          <p className="text-sm text-blue-600 mt-2">
            {totalSelected} resource{totalSelected !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="assets" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Assets ({wizardState.selectedAssets.length})</span>
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Knowledge Bases ({wizardState.selectedKnowledgeBases.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="mt-4">
            {assets.length > 0 ? (
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-2">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
                      onClick={() => toggleAsset(asset.id)}
                    >
                      <Checkbox
                        id={`asset-${asset.id}`}
                        checked={wizardState.selectedAssets.includes(asset.id)}
                        onCheckedChange={() => toggleAsset(asset.id)}
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
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="mx-auto h-8 w-8 mb-2" />
                <p>No assets available</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="knowledge" className="mt-4">
            {knowledgeBases.length > 0 ? (
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-2">
                  {knowledgeBases.map((kb) => (
                    <div
                      key={kb.id}
                      className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
                      onClick={() => toggleKnowledgeBase(kb.id)}
                    >
                      <Checkbox
                        id={`kb-${kb.id}`}
                        checked={wizardState.selectedKnowledgeBases.includes(kb.id)}
                        onCheckedChange={() => toggleKnowledgeBase(kb.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <Database className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{kb.title}</span>
                          </div>
                          {kb.token_count && (
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                              {kb.token_count.toLocaleString()} tokens
                            </span>
                          )}
                        </div>
                        {kb.description && (
                          <p className="text-xs text-gray-500 mt-1 ml-6 truncate">
                            {kb.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Database className="mx-auto h-8 w-8 mb-2" />
                <p>No knowledge bases available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex justify-between pt-6 border-t">
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
            className="min-w-[100px]"
          >
            {totalSelected > 0 ? 'Continue' : 'Skip'}
          </Button>
        </div>
      </div>
    </div>
  );
}