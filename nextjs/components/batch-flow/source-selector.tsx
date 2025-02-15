import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetUploader } from "@/components/asset-uploader";
import { KnowledgeBaseSelector } from "@/components/knowledge-base-selector";
import { UploadedFile } from "@/utils/upload-service";
import { Asset, KnowledgeBase } from "@/types/knowledge-base";
import { useSession } from '@/app/utils/session/session';
import { fetchKnowledgeBases } from '@/utils/knowledge-base-service';
import { useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BatchFlowFile } from '@/types';

interface SourceSelectorProps {
  onFileUpload: (file: BatchFlowFile) => void;
  onAssetSelect: (assets: Asset[]) => void;
  onKnowledgeBaseSelect: (kbs: KnowledgeBase[]) => void;
  selectedAssets: Asset[];
  selectedKnowledgeBases: KnowledgeBase[];
  uploadedFiles: BatchFlowFile[];
}

export function SourceSelector({
  onFileUpload,
  onAssetSelect,
  onKnowledgeBaseSelect,
  selectedAssets,
  selectedKnowledgeBases,
  uploadedFiles
}: SourceSelectorProps) {
  const [activeTab, setActiveTab] = useState("upload");
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(true);
  const { getApiHeaders } = useSession();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = await getApiHeaders();
        if (!headers) return;

        setIsLoadingKnowledgeBases(true);
        const fetchedKnowledgeBases = await fetchKnowledgeBases(headers);
        setKnowledgeBases(fetchedKnowledgeBases);
      } catch (error) {
        console.error('Error fetching knowledge bases:', error);
      } finally {
        setIsLoadingKnowledgeBases(false);
      }
    };
    fetchData();
  }, [getApiHeaders]);

  const renderFileStatus = (file: BatchFlowFile) => {
    return (
      <li key={file.id} className="flex items-center justify-between py-2">
        <span>{file.name}</span>
        <span className="text-sm text-muted-foreground">
          {file.status.status === 'pending' ? 'Processing...' : 
           file.status.status === 'completed' ? 'Ready' :
           file.status.status === 'failed' ? 'Failed' :
           'Processing...'}
        </span>
      </li>
    );
  };

  const handleFileUpload = (file: UploadedFile) => {
    // Convert UploadedFile to BatchFlowFile
    const batchFlowFile: BatchFlowFile = {
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadURL: file.uploadURL,
      file_name: file.name,
      status: {
        id: '',
        status: 'pending',
        token_count: 0,
        file_name: file.name
      }
    };
    onFileUpload(batchFlowFile);
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
          <TabsTrigger value="select">Select Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <AssetUploader
            onUploadComplete={(files) => {
              files.forEach(handleFileUpload);
            }}
          />
          
          {uploadedFiles.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Upload Status:</h4>
              <ScrollArea className="h-[200px]">
                <ul className="divide-y">
                  {uploadedFiles.map(renderFileStatus)}
                </ul>
              </ScrollArea>
            </div>
          )}
        </TabsContent>

        <TabsContent value="select">
          <div className="border rounded-lg p-4">
            <KnowledgeBaseSelector
              knowledgeBases={knowledgeBases}
              isLoadingKnowledgeBases={isLoadingKnowledgeBases}
              selectedKnowledgeBases={selectedKnowledgeBases}
              selectedAssets={selectedAssets}
              onSelectKnowledgeBase={(kb: KnowledgeBase) => {
                onKnowledgeBaseSelect([...selectedKnowledgeBases, kb]);
              }}
              onDeselectKnowledgeBase={(kb: KnowledgeBase) => {
                onKnowledgeBaseSelect(selectedKnowledgeBases.filter(k => k.id !== kb.id));
              }}
              onSelectAsset={(asset: Asset) => {
                onAssetSelect([...selectedAssets, asset]);
              }}
              onDeselectAsset={(asset: Asset) => {
                onAssetSelect(selectedAssets.filter(a => a.id !== asset.id));
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Selected Sources</h3>
        <div className="space-y-2">
          {uploadedFiles.length > 0 && (
            <div>
              <h4 className="font-medium">Uploaded Files:</h4>
              <ul className="list-disc pl-5">
                {uploadedFiles.map(file => (
                  <li key={file.id}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}
          
          {selectedAssets.length > 0 && (
            <div>
              <h4 className="font-medium">Selected Assets:</h4>
              <ul className="list-disc pl-5">
                {selectedAssets.map(asset => (
                  <li key={asset.id}>{asset.title}</li>
                ))}
              </ul>
            </div>
          )}
          
          {selectedKnowledgeBases.length > 0 && (
            <div>
              <h4 className="font-medium">Selected Knowledge Bases:</h4>
              <ul className="list-disc pl-5">
                {selectedKnowledgeBases.map(kb => (
                  <li key={kb.id}>{kb.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 