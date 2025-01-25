'use client';

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { X, Upload } from 'lucide-react'
import { KnowledgeBase, createKnowledgeBase, updateKnowledgeBase, KnowledgeBaseCreate } from '@/utils/knowledge-base-service'
import { useSession } from '@/app/utils/session/session'
import { AssetsTable } from './assets-table';
import { Asset } from '@/types/knowledge-base';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchAssets } from '@/utils/asset-service';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { useToast } from "@/hooks/use-toast";
import { useParams } from 'next/navigation';
import { fetchAssetsForKnowledgeBase } from '@/utils/knowledge-base-service';
import { UploadService } from '@/utils/upload-service';
import { Uppy } from '@uppy/core';
import { Dashboard } from '@uppy/react';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';

interface KnowledgeBaseManagerProps {
  knowledgeBase: KnowledgeBase | null;
  onSave: () => void;
  onClose: () => void;
}

export default function KnowledgeBaseManager({ knowledgeBase, onSave, onClose }: KnowledgeBaseManagerProps): JSX.Element {
  const params = useParams();
  const knowledgeBaseId = params?.id as string || knowledgeBase?.id || undefined;
  const [currentKnowledgeBase, setCurrentKnowledgeBase] = useState({
    title: knowledgeBase?.title || '',
    description: knowledgeBase?.description || '',
    assets: knowledgeBase?.assets || [] as Asset[]
  });
  const { getApiHeaders } = useSession();
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>(knowledgeBase?.assets || []);
  const supabase = useSupabase();
  const { toast } = useToast();
  const [uppy, setUppy] = useState<Uppy | null>(null);

  const loadAssets = useCallback(async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) return;
      const assets = await fetchAssets(headers);
      setAvailableAssets(assets.filter(asset => asset.managed));
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  }, [getApiHeaders]);

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
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    console.log('Selected assets updated:', selectedAssets);
    setCurrentKnowledgeBase(prev => ({
      ...prev,
      assets: selectedAssets
    }));
  }, [selectedAssets]);

  useEffect(() => {
    if (!supabase) return;

    const uppyInstance = UploadService.createUppy(
      'knowledge-base-uploader',
      {
        maxFiles: 10,
        storageFolder: 'knowledge-bases',
        storageBucket: 'amaruai-dev'
      },
      async (file) => {
        console.log('File uploaded:', file);
      },
      async (result) => {
        try {
          const headers = getApiHeaders();
          if (!headers) return;

          if (knowledgeBaseId) {
            const updatedAssets = await fetchAssetsForKnowledgeBase(knowledgeBaseId, headers);
            setSelectedAssets(updatedAssets);
          }

          setShowUploadModal(false);
          toast({
            title: "Success",
            description: `${result.successful?.length || 0} file(s) uploaded successfully`,
          });
        } catch (error) {
          console.error('Error processing uploaded files:', error);
          toast({
            title: "Error",
            description: "Failed to process uploaded files",
            variant: "destructive",
          });
        }
      },
      supabase,
      knowledgeBaseId
    );

    setUppy(uppyInstance);

    return () => {
      if (uppyInstance) {
        const allFileIds = uppyInstance.getFiles().map(file => file.id);
        uppyInstance.cancelAll();
        uppyInstance.removeFiles(allFileIds);
        uppyInstance.destroy();
      }
    };
  }, [supabase, toast, getApiHeaders, knowledgeBaseId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentKnowledgeBase(prev => ({ ...prev, [name]: value }));
  };

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

      if (knowledgeBaseId) {
        await updateKnowledgeBase(knowledgeBaseId, payload, headers);
      } else {
        await createKnowledgeBase(payload, headers);
      }
      
      onSave();
      toast({
        title: "Success",
        description: `Knowledge base ${knowledgeBaseId ? 'updated' : 'created'} successfully`,
      });
    } catch (error) {
      console.error('Error saving knowledge base:', error);
      toast({
        title: "Error",
        description: "Failed to save knowledge base",
        variant: "destructive",
      });
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
    <div className="h-screen w-full bg-background">
      <div className="max-w-4xl w-full mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {knowledgeBaseId ? 'Edit Knowledge Base' : 'Create Knowledge Base'}
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
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Assets
                  </Button>
                  <Button onClick={() => setShowAssetSelector(true)}>
                    Select Assets
                  </Button>
                </div>
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
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 py-4 px-4 bg-background border-t">
        <div className="max-w-4xl w-full mx-auto flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save Changes
          </Button>
        </div>
      </div>

      <Dialog open={showAssetSelector} onOpenChange={setShowAssetSelector}>
        <DialogContent className="sm:max-w-4xl bg-background">
          <DialogHeader>
            <DialogTitle>Select Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4 bg-background">
            <div className="overflow-hidden rounded-md border">
              <AssetsTable 
                assets={availableAssets.filter(asset => 
                  !selectedAssets.some(selected => selected.id === asset.id)
                )}
                showActions={true}
                onManageAsset={handleAddAsset}
                className="bg-background"
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

      {/* Upload Modal */}
      {showUploadModal && uppy && (
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="sm:max-w-2xl bg-background">
            <DialogHeader>
              <DialogTitle>Upload Assets</DialogTitle>
            </DialogHeader>
            <div className="py-4 bg-background">
              <Dashboard 
                uppy={uppy} 
                plugins={[]} 
                proudlyDisplayPoweredByUppy={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}