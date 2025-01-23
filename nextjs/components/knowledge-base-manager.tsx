'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import { AssetUploader } from '@/components/asset-uploader';
import { useParams } from 'next/navigation';
import { fetchAssetsForKnowledgeBase } from '@/utils/knowledge-base-service';
import { UploadService } from '@/utils/upload-service';

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
  const uppyRef = useRef<any>(null);

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
    if (!uppyRef.current && supabase) {
      const uppy = UploadService.createUppy(
        'knowledge-base-uploader',
        {
          maxFiles: 10,
          storageFolder: 'knowledge-bases',
          storageBucket: 'amaruai-dev'
        },
        async (file) => {
          // Individual file upload complete
          console.log('File uploaded:', file);
          // Don't show individual file toasts in knowledge base context
        },
        async (result) => {
          // All files upload complete
          try {
            const headers = getApiHeaders();
            if (!headers) return;

            // Fetch updated assets for this knowledge base
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
        knowledgeBaseId  // Pass the knowledge base ID to the uploader
      );

      uppyRef.current = uppy;
    }

    return () => {
      if (uppyRef.current) {
        uppyRef.current.close();
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
        console.log('Updating existing knowledge base:', knowledgeBaseId);
        await updateKnowledgeBase(knowledgeBaseId, payload, headers);
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

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 sticky bottom-0 py-4 bg-background border-t">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button 
                onClick={handleSave} 
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showAssetSelector} onOpenChange={setShowAssetSelector}>
        <DialogContent className="max-w-4xl bg-white">
          <DialogHeader className="bg-white">
            <DialogTitle className="text-gray-900">Select Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4 bg-white">
            <div className="overflow-hidden rounded-md border">
              <AssetsTable 
                assets={availableAssets.filter(asset => 
                  !selectedAssets.some(selected => selected.id === asset.id)
                )}
                showActions={true}
                onManageAsset={handleAddAsset}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 bg-white">
            <Button variant="outline" onClick={() => setShowAssetSelector(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      {showUploadModal && (
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Assets</DialogTitle>
            </DialogHeader>
            <AssetUploader 
              knowledgeBaseId={knowledgeBaseId}
              onUploadComplete={async (files) => {
                try {
                  const headers = getApiHeaders();
                  if (!headers || !knowledgeBaseId) return;

                  // Refresh the assets list
                  const updatedKnowledgeBaseAssets = await fetchAssetsForKnowledgeBase(knowledgeBaseId, headers);
                  setSelectedAssets(updatedKnowledgeBaseAssets);
                  setShowUploadModal(false);
                } catch (error) {
                  console.error('Error updating assets:', error);
                  toast({
                    title: "Error",
                    description: "Failed to update assets",
                    variant: "destructive",
                  });
                }
              }}
              onUploadError={(error) => {
                toast({
                  title: "Error",
                  description: "Failed to upload files",
                  variant: "destructive",
                });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}