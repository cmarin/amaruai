'use client';

import React, { useState, useEffect, useRef } from 'react'
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
import { UploadService, type UploadedFile } from '@/utils/upload-service';
import { useToast } from "@/hooks/use-toast";
import Uppy, { UppyFile, UploadResult } from '@uppy/core';
import { Dashboard } from '@uppy/react';
import DashboardPlugin from '@uppy/dashboard';
import { v4 as uuidv4 } from 'uuid';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';

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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>(knowledgeBase?.assets || []);
  const supabase = useSupabase();
  const { toast } = useToast();
  const uppyRef = useRef<any>(null);

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

  useEffect(() => {
    // Only initialize Uppy when the modal is shown
    if (showUploadModal && !uppyRef.current && supabase) {
      const uppy = new Uppy({
        id: 'knowledge-base-uploader',
        autoProceed: false,
        restrictions: {
          maxFileSize: 50 * 1024 * 1024, // 50MB
          maxNumberOfFiles: 10,
          allowedFileTypes: [
            'image/*',                    // All image types
            'application/pdf',            // PDF files
            '.doc', '.docx',             // Word documents
            '.ppt', '.pptx',             // PowerPoint presentations
            '.txt',                       // Text files
            '.md', '.markdown',           // Markdown files
            'text/plain',                 // Plain text
            'text/markdown',              // Markdown MIME type
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
            'application/vnd.ms-powerpoint', // PPT
            'audio/wav',                  // WAV audio
            'audio/mpeg',                 // MP3 audio
            'audio/flac',                 // FLAC audio
            'video/mp4',                  // MP4 video
            'video/quicktime',            // MOV video
            '.wav', '.mp3', '.flac',     // Audio extensions
            '.mp4', '.mov'               // Video extensions
          ]
        }
      });

      // Add the Dashboard plugin
      uppy.use(DashboardPlugin, {
        inline: true,
        target: '.uppy-dashboard-container',
        showProgressDetails: true,
        height: 350,
        width: '100%'
      });

      uppy.on('file-added', async (file) => {
        try {
          // Upload file to Supabase storage
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.id) {
            throw new Error('User must be authenticated to upload files');
          }

          const fileUuid = uuidv4();
          const filePath = `knowledge-bases/${session.user.id}/${fileUuid}/${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from('amaruai-dev')
            .upload(filePath, file.data);

          if (uploadError) {
            throw uploadError;
          }

          toast({
            title: "File uploaded",
            description: `${file.name} has been uploaded successfully.`,
          });
        } catch (error) {
          console.error('Error uploading file:', error);
          toast({
            title: "Error",
            description: "Failed to upload file",
            variant: "destructive",
          });
        }
      });

      uppy.on('complete', async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
        try {
          const headers = getApiHeaders();
          if (!headers) return;

          // Refresh the available assets list
          const assets = await fetchAssets(headers);
          setAvailableAssets(assets.filter(asset => asset.managed));

          // Add uploaded files to selected assets
          const successfulFiles = result.successful || [];
          if (successfulFiles.length > 0) {
            const newAssets = assets.filter(asset => 
              successfulFiles.some(file => asset.title === file.name)
            );
            setSelectedAssets(prev => [...prev, ...newAssets]);
          }

          setShowUploadModal(false);
          toast({
            title: "Success",
            description: `${successfulFiles.length} file(s) uploaded successfully`,
          });
        } catch (error) {
          console.error('Error processing uploaded files:', error);
          toast({
            title: "Error",
            description: "Failed to process uploaded files",
            variant: "destructive",
          });
        }
      });

      uppyRef.current = uppy;
    }

    return () => {
      if (uppyRef.current) {
        uppyRef.current.close();
        uppyRef.current = null;
      }
    };
  }, [showUploadModal, supabase, getApiHeaders, toast]);

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
      <Dialog open={showUploadModal} onOpenChange={(open) => {
        setShowUploadModal(open);
        if (!open && uppyRef.current) {
          uppyRef.current.close();
          uppyRef.current = null;
        }
      }}>
        <DialogContent className="max-w-4xl bg-white">
          <DialogHeader className="bg-white">
            <DialogTitle className="text-gray-900">Upload Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4 bg-white min-h-[400px]">
            <div className="uppy-dashboard-container" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 