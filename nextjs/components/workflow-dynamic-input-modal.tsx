'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Database, X, Loader2 } from 'lucide-react';
import { Asset, KnowledgeBase } from '@/types/knowledge-base';
import { fetchAssets } from '@/utils/asset-service';
import { fetchKnowledgeBases } from '@/utils/knowledge-base-service';
import { useSession } from '@/app/utils/session/session';
import { useToast } from "@/hooks/use-toast";
import { Workflow } from '@/types/workflow';
import { AssetUploaderFixed } from '@/components/asset-uploader-fixed';
import { UploadedFile } from '@/utils/upload-service';

interface WorkflowDynamicInputModalProps {
  workflow: Workflow;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    uploadedFiles: UploadedFile[];
    selectedAssets: string[];
    selectedKnowledgeBases: string[];
  }) => void;
}

export function WorkflowDynamicInputModal({
  workflow,
  isOpen,
  onClose,
  onSubmit
}: WorkflowDynamicInputModalProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<string[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const { getApiHeaders } = useSession();
  const { toast } = useToast();
  const uploadedFilesRef = useRef<UploadedFile[]>([]);

  // Determine which tabs to show based on workflow settings
  const showFileUpload = workflow.allow_file_upload;
  const showAssetSelection = workflow.allow_asset_selection;
  
  // Set initial tab based on what's available
  useEffect(() => {
    if (showFileUpload) {
      setActiveTab('upload');
    } else if (showAssetSelection) {
      setActiveTab('assets');
    }
  }, [showFileUpload, showAssetSelection]);

  // Load assets and knowledge bases if selection is allowed
  useEffect(() => {
    if (showAssetSelection && isOpen) {
      loadAssetsAndKnowledgeBases();
    }
  }, [showAssetSelection, isOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setUploadedFiles([]);
      uploadedFilesRef.current = [];
      setSelectedAssets([]);
      setSelectedKnowledgeBases([]);
    }
  }, [isOpen]);

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
      console.error('Error loading assets and knowledge bases:', error);
      toast({
        title: "Error",
        description: "Failed to load assets and knowledge bases",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUploaded = useCallback((file: UploadedFile) => {
    console.log('File uploaded:', file);
    setUploadedFiles(prev => {
      const updated = [...prev, file];
      uploadedFilesRef.current = updated;
      return updated;
    });
  }, []);

  const handleUploadComplete = useCallback((result: any) => {
    console.log('Upload complete, uploaded files:', uploadedFilesRef.current);
    // The files have already been added via handleFileUploaded
    // This is just a completion signal
  }, []);

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      uploadedFilesRef.current = updated;
      return updated;
    });
  };

  const toggleAsset = (assetId: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const toggleKnowledgeBase = (kbId: string) => {
    setSelectedKnowledgeBases(prev => 
      prev.includes(kbId) 
        ? prev.filter(id => id !== kbId)
        : [...prev, kbId]
    );
  };

  const handleSubmit = () => {
    console.log('Submitting with:', {
      uploadedFiles: uploadedFilesRef.current,
      selectedAssets,
      selectedKnowledgeBases
    });
    
    onSubmit({
      uploadedFiles: uploadedFilesRef.current,
      selectedAssets,
      selectedKnowledgeBases
    });
    
    // Clean up will happen via the useEffect when modal closes
  };

  const hasSelections = uploadedFiles.length > 0 || 
                        selectedAssets.length > 0 || 
                        selectedKnowledgeBases.length > 0;

  // Calculate number of tabs to show
  const tabCount = (showFileUpload ? 1 : 0) + (showAssetSelection ? 2 : 0);
  const tabGridCols = tabCount === 1 ? 'grid-cols-1' : tabCount === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Prepare Workflow Resources</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className={`grid w-full ${tabGridCols}`}>
            {showFileUpload && (
              <TabsTrigger value="upload">
                <Upload className="mr-2 h-4 w-4" />
                Upload Files ({uploadedFiles.length})
              </TabsTrigger>
            )}
            {showAssetSelection && (
              <>
                <TabsTrigger value="assets">
                  <FileText className="mr-2 h-4 w-4" />
                  Assets ({selectedAssets.length})
                </TabsTrigger>
                <TabsTrigger value="knowledge">
                  <Database className="mr-2 h-4 w-4" />
                  Knowledge Bases ({selectedKnowledgeBases.length})
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {showFileUpload && (
            <TabsContent value="upload" className="mt-4 flex-1">
              <div className="space-y-4 h-full">
                <div className="mb-2">
                  <p className="text-sm text-gray-600">
                    Upload files to include in this workflow execution. Files will be uploaded when you click the upload button in the widget below.
                  </p>
                </div>
                
                {/* Pass individual file handler instead of batch handler */}
                <AssetUploaderFixed 
                  key={`uploader-${isOpen}`} // Force new instance when modal opens
                  onFileUploaded={handleFileUploaded}
                  onUploadComplete={handleUploadComplete}
                  onUploadError={(error) => {
                    toast({
                      title: "Upload Error",
                      description: error.message,
                      variant: "destructive"
                    });
                  }}
                />

                {uploadedFiles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Uploaded Files:</h4>
                    <ScrollArea className="h-[100px] border rounded-lg p-2">
                      <div className="space-y-2">
                        {uploadedFiles.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">{file.name}</span>
                              <span className="text-xs text-gray-500">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(file.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {showAssetSelection && (
            <>
              <TabsContent value="assets" className="mt-4 flex-1">
                {isLoading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] border rounded-lg p-4">
                    <div className="space-y-2">
                      {assets.map((asset) => (
                        <div key={asset.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                          <Checkbox
                            id={`asset-${asset.id}`}
                            checked={selectedAssets.includes(asset.id)}
                            onCheckedChange={() => toggleAsset(asset.id)}
                          />
                          <label
                            htmlFor={`asset-${asset.id}`}
                            className="flex-1 cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">{asset.title || asset.file_name}</span>
                            </div>
                            {asset.size && (
                              <span className="text-xs text-gray-500">
                                {(asset.size / 1024).toFixed(1)} KB
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="knowledge" className="mt-4 flex-1">
                {isLoading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] border rounded-lg p-4">
                    <div className="space-y-2">
                      {knowledgeBases.map((kb) => (
                        <div key={kb.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                          <Checkbox
                            id={`kb-${kb.id}`}
                            checked={selectedKnowledgeBases.includes(kb.id)}
                            onCheckedChange={() => toggleKnowledgeBase(kb.id)}
                          />
                          <label
                            htmlFor={`kb-${kb.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Database className="h-4 w-4 text-gray-500" />
                                <span className="text-sm">{kb.title}</span>
                              </div>
                              {kb.token_count && (
                                <span className="text-xs text-gray-500">
                                  {kb.token_count.toLocaleString()} tokens
                                </span>
                              )}
                            </div>
                            {kb.description && (
                              <p className="text-xs text-gray-500 mt-1 ml-6">
                                {kb.description}
                              </p>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!hasSelections}
          >
            Continue with Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}