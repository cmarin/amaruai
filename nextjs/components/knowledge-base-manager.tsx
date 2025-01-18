'use client';

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { X } from 'lucide-react'
import { KnowledgeBase, createKnowledgeBase, updateKnowledgeBase, KnowledgeBaseCreate } from '@/utils/knowledge-base-service'
import { useSession } from '@/app/utils/session/session'
import { AssetsTable } from './assets-table';
import { Asset } from '@/types/knowledge-base';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchAssets } from '@/utils/asset-service';

type KnowledgeBaseManagerProps = {
  knowledgeBase: KnowledgeBase | null
  onSave: () => void
  onClose: () => void
}

export function KnowledgeBaseManager({ knowledgeBase, onSave, onClose }: KnowledgeBaseManagerProps) {
  const [currentKnowledgeBase, setCurrentKnowledgeBase] = useState({
    title: '',
    description: '',
    assets: [] as Asset[]
  });
  const { getApiHeaders } = useSession();
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>(knowledgeBase?.assets || []);

  useEffect(() => {
    if (knowledgeBase) {
      console.log('KnowledgeBaseManager received knowledgeBase:', knowledgeBase);
      const initialState = {
        title: knowledgeBase.title,
        description: knowledgeBase.description,
        assets: knowledgeBase.assets || []
      };
      console.log('Setting initial state:', initialState);
      setCurrentKnowledgeBase(initialState);
      setSelectedAssets(knowledgeBase.assets || []);
    }
  }, [knowledgeBase]);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const headers = getApiHeaders();
        if (!headers) return;
        const assets = await fetchAssets(headers);
        setAvailableAssets(assets.filter(asset => asset.managed));
      } catch (error) {
        console.error('Error loading assets:', error);
      }
    };
    loadAssets();
  }, [getApiHeaders]);

  useEffect(() => {
    console.log('Selected assets updated:', selectedAssets);
    setCurrentKnowledgeBase(prev => ({
      ...prev,
      assets: selectedAssets
    }));
  }, [selectedAssets]);

  useEffect(() => {
    console.log('AssetsTable assets updated:', selectedAssets);
  }, [selectedAssets]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setCurrentKnowledgeBase(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      const payload: KnowledgeBaseCreate = {
        title: currentKnowledgeBase.title,
        description: currentKnowledgeBase.description,
        asset_ids: selectedAssets.map(asset => asset.id)
      };

      if (knowledgeBase?.id) {
        console.log('Updating existing knowledge base:', knowledgeBase.id);
        await updateKnowledgeBase(knowledgeBase.id, payload, headers);
      } else {
        console.log('Creating new knowledge base');
        await createKnowledgeBase(payload, headers);
      }
      onSave();
    } catch (error) {
      console.error('Error saving knowledge base:', error);
    }
  };

  const handleAddAsset = (asset: Asset) => {
    setSelectedAssets(prev => [...prev, asset]);
    setShowAssetSelector(false);
  };

  const handleRemoveAsset = (assetId: string) => {
    setSelectedAssets(prev => prev.filter(asset => asset.id !== assetId));
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 z-50 flex flex-col h-screen" style={{ 
      left: 'var(--sidebar-width)',
      transition: 'left 0.3s ease-in-out'
    }}>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="container max-w-4xl mx-auto py-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              {knowledgeBase?.id ? 'Edit Knowledge Base' : 'Create Knowledge Base'}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="space-y-6">
            {/* Title and Description Panel */}
            <div className="rounded-lg border bg-card text-card-foreground shadow">
              <div className="p-6 space-y-4">
                <div>
                  <Label htmlFor="title" className="text-base">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={currentKnowledgeBase.title}
                    onChange={handleInputChange}
                    placeholder="Enter knowledge base title"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-base">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={currentKnowledgeBase.description}
                    onChange={handleInputChange}
                    placeholder="Enter knowledge base description"
                    className="mt-1.5 min-h-[100px]"
                  />
                </div>
              </div>
            </div>

            {/* Assets Panel */}
            <div className="rounded-lg border bg-card text-card-foreground shadow">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Assets</h3>
                  <Button onClick={() => setShowAssetSelector(true)}>
                    Select Assets
                  </Button>
                </div>
                <div className="overflow-hidden rounded-md border">
                  <AssetsTable 
                    assets={selectedAssets}
                    onDeleteAsset={handleRemoveAsset}
                    showActions={true}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 sticky bottom-0 py-4 bg-background border-t">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showAssetSelector} onOpenChange={setShowAssetSelector}>
        <DialogContent className="max-w-4xl bg-background">
          <DialogHeader>
            <DialogTitle>Select Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="overflow-hidden rounded-md border bg-white">
              <AssetsTable 
                assets={availableAssets.filter(asset => 
                  !selectedAssets.some(selected => selected.id === asset.id)
                )}
                showActions={true}
                onManageAsset={handleAddAsset}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAssetSelector(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 