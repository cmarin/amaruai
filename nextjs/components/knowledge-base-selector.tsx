'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/app/utils/session/session';
import { KnowledgeBase } from '@/utils/knowledge-base-service';
import { fetchAssets } from '@/utils/asset-service';
import { Asset } from '@/types/knowledge-base';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Database } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface KnowledgeBaseSelectorProps {
  knowledgeBases: KnowledgeBase[];
  isLoadingKnowledgeBases: boolean;
  selectedKnowledgeBases: KnowledgeBase[];
  selectedAssets: Asset[];
  onSelectKnowledgeBase: (knowledgeBase: KnowledgeBase) => void;
  onDeselectKnowledgeBase: (knowledgeBase: KnowledgeBase) => void;
  onSelectAsset: (asset: Asset) => void;
  onDeselectAsset: (asset: Asset) => void;
}

export function KnowledgeBaseSelector({
  knowledgeBases,
  isLoadingKnowledgeBases,
  selectedKnowledgeBases,
  selectedAssets,
  onSelectKnowledgeBase,
  onDeselectKnowledgeBase,
  onSelectAsset,
  onDeselectAsset,
}: KnowledgeBaseSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('knowledge-bases');
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Add Knowledge Base or Asset">
          <Database className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <div className="p-2 space-y-2">
          <Input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2"
          />
          
          <div className="flex flex-wrap gap-1 min-h-[32px]">
            {selectedKnowledgeBases.map(kb => (
              <Badge key={kb.id} variant="secondary" className="gap-1 pr-1">
                {kb.title}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => onDeselectKnowledgeBase(kb)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {selectedAssets.map(asset => (
              <Badge key={asset.id} variant="secondary" className="gap-1 pr-1">
                {asset.title}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => onDeselectAsset(asset)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>

        <Tabs defaultValue="knowledge-bases" className="w-full" value={activeTab} onValueChange={handleTabChange}>
          <div className="border-t border-b px-2 py-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="knowledge-bases">Knowledge Bases</TabsTrigger>
              <TabsTrigger value="assets">Assets</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="knowledge-bases" className="mt-0">
            <ScrollArea className="h-[300px]">
              <div className="p-2 space-y-1">
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
                      variant="ghost"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => onSelectKnowledgeBase(kb)}
                    >
                      <div>
                        <div className="font-medium">{kb.title}</div>
                        {kb.description && (
                          <div className="text-sm text-muted-foreground line-clamp-2">{kb.description}</div>
                        )}
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="assets" className="mt-0">
            <ScrollArea className="h-[300px]">
              <div className="p-2 space-y-1">
                {isLoadingAssets ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-sm text-muted-foreground">Loading assets...</div>
                  </div>
                ) : (
                  filteredAssets.map(asset => (
                    <Button
                      key={asset.id}
                      variant="ghost"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => onSelectAsset(asset)}
                    >
                      <div>
                        <div className="font-medium">{asset.title}</div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
