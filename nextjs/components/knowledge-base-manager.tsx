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
      setCurrentKnowledgeBase({
        title: knowledgeBase.title,
        description: knowledgeBase.description,
        assets: knowledgeBase.assets || []
      });
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
    setCurrentKnowledgeBase(prev => ({
      ...prev,
      assets: selectedAssets
    }));
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

      if (knowledgeBase) {
        await updateKnowledgeBase(knowledgeBase.id, payload, headers);
      } else {
        await createKnowledgeBase(payload, headers);
      }
      onSave();
    } catch (error) {
      console.error('Error saving knowledge base:', error);
    }
  }

  const handleAddAsset = (asset: Asset) => {
    setSelectedAssets(prev => [...prev, asset]);
    setShowAssetSelector(false);
  };

  const handleRemoveAsset = (assetId: string) => {
    setSelectedAssets(prev => prev.filter(asset => asset.id !== assetId));
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col h-screen">
      <div className="h-full w-full overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">
              {knowledgeBase ? 'Edit Knowledge Base' : 'Create Knowledge Base'}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={currentKnowledgeBase.title}
                onChange={handleInputChange}
                placeholder="Enter knowledge base title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={currentKnowledgeBase.description}
                onChange={handleInputChange}
                placeholder="Enter knowledge base description"
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Assets</h3>
                <Button onClick={() => setShowAssetSelector(true)}>
                  Select Assets
                </Button>
              </div>
              <AssetsTable 
                assets={selectedAssets}
                onDeleteAsset={handleRemoveAsset}
                showActions={true}
              />
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showAssetSelector} onOpenChange={setShowAssetSelector}>
        <DialogContent className="max-w-4xl bg-white">
          <DialogHeader>
            <DialogTitle>Select Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <AssetsTable 
              assets={availableAssets.filter(asset => 
                !selectedAssets.some(selected => selected.id === asset.id)
              )}
              showActions={true}
              onManageAsset={handleAddAsset}
            />
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