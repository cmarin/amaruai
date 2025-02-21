'use client';

import { Dashboard } from '@uppy/react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from 'react';
import { X } from "lucide-react";
import type { BatchFlowFile } from "@/types";
import type { KnowledgeBase } from '@/utils/knowledge-base-service';
import type { Asset } from '@/types/knowledge-base';
import { fetchAssets } from '@/utils/asset-service';
import { useSession } from '@/app/utils/session/session';

interface UploadStepProps {
  uppyRef: any;
  uploadedFiles: BatchFlowFile[];
  knowledgeBases: KnowledgeBase[];
  isLoadingKnowledgeBases: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onKnowledgeBasesChange: (kbs: KnowledgeBase[]) => void;
  onAssetsChange: (assets: Asset[]) => void;
}

export function UploadStep({
  uppyRef,
  uploadedFiles,
  knowledgeBases,
  isLoadingKnowledgeBases,
  onPrevious,
  onNext,
  onKnowledgeBasesChange,
  onAssetsChange,
}: UploadStepProps) {
  const [activeTab, setActiveTab] = useState('files');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [localAssets, setLocalAssets] = useState<Asset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const { getApiHeaders } = useSession();

  const handleTabChange = async (value: string) => {
    setActiveTab(value);
    if (value === 'assets' && localAssets.length === 0 && !isLoadingAssets) {
      setIsLoadingAssets(true);
      try {
        const headers = await getApiHeaders();
        if (headers) {
          const fetchedAssets = await fetchAssets(headers);
          setLocalAssets(fetchedAssets);
        }
      } catch (error) {
        console.error('Error fetching assets:', error);
      } finally {
        setIsLoadingAssets(false);
      }
    }
  };

  const filteredKnowledgeBases = knowledgeBases.filter(kb =>
    kb.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    kb.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAssets = localAssets.filter(asset =>
    asset.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectKnowledgeBase = (kb: KnowledgeBase) => {
    if (!selectedKnowledgeBases.find(selected => selected.id === kb.id)) {
      const newKbs = [...selectedKnowledgeBases, kb];
      setSelectedKnowledgeBases(newKbs);
      onKnowledgeBasesChange(newKbs);
    }
  };

  const handleDeselectKnowledgeBase = (kb: KnowledgeBase) => {
    const newKbs = selectedKnowledgeBases.filter(selected => selected.id !== kb.id);
    setSelectedKnowledgeBases(newKbs);
    onKnowledgeBasesChange(newKbs);
  };

  const handleSelectAsset = (asset: Asset) => {
    if (!selectedAssets.find(selected => selected.id === asset.id)) {
      const newAssets = [...selectedAssets, asset];
      setSelectedAssets(newAssets);
      onAssetsChange(newAssets);
    }
  };

  const handleDeselectAsset = (asset: Asset) => {
    const newAssets = selectedAssets.filter(selected => selected.id !== asset.id);
    setSelectedAssets(newAssets);
    onAssetsChange(newAssets);
  };

  const canProceed = uploadedFiles.length > 0 || selectedKnowledgeBases.length > 0 || selectedAssets.length > 0;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="files">Uploads</TabsTrigger>
          <TabsTrigger value="knowledge-bases">Knowledge Bases</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="mt-4">
          <Dashboard
            uppy={uppyRef}
            proudlyDisplayPoweredByUppy={false}
            showProgressDetails
            height={400}
            showRemoveButtonAfterComplete={true}
            hideUploadButton={true}
            hideRetryButton={true}
            hideCancelButton={false}
            doneButtonHandler={null}
          />
        </TabsContent>

        <TabsContent value="knowledge-bases" className="mt-4">
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Search knowledge bases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            
            <div className="flex flex-wrap gap-2 min-h-[32px]">
              {selectedKnowledgeBases.map(kb => (
                <Badge key={kb.id} variant="secondary" className="gap-1 pr-1">
                  {kb.title}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => handleDeselectKnowledgeBase(kb)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {isLoadingKnowledgeBases ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-sm text-muted-foreground">Loading knowledge bases...</div>
                  </div>
                ) : filteredKnowledgeBases.length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-sm text-muted-foreground">No knowledge bases found</div>
                  </div>
                ) : (
                  filteredKnowledgeBases.map(kb => (
                    <Button
                      key={kb.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4 border-muted hover:bg-muted/5 transition-colors mb-2"
                      onClick={() => handleSelectKnowledgeBase(kb)}
                    >
                      <div>
                        <div className="font-medium">{kb.title}</div>
                        {kb.description && (
                          <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{kb.description}</div>
                        )}
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            
            <div className="flex flex-wrap gap-2 min-h-[32px]">
              {selectedAssets.map(asset => (
                <Badge key={asset.id} variant="secondary" className="gap-1 pr-1">
                  {asset.title}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => handleDeselectAsset(asset)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {isLoadingAssets ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-sm text-muted-foreground">Loading assets...</div>
                  </div>
                ) : filteredAssets.length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-sm text-muted-foreground">No assets found</div>
                  </div>
                ) : (
                  filteredAssets.map(asset => (
                    <Button
                      key={asset.id}
                      variant="outline" 
                      className="w-full justify-start text-left h-auto py-3 px-4 border-muted hover:bg-muted/5 transition-colors mb-2"
                      onClick={() => handleSelectAsset(asset)}
                    >
                      <div>
                        <div className="font-medium">{asset.title}</div>
                        {asset.description && (
                          <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{asset.description}</div>
                        )}
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between mt-4">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={true}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={onNext}
          disabled={!canProceed}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
