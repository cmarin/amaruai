import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetUploader } from "@/components/asset-uploader";
import { KnowledgeBaseSelector } from "@/components/knowledge-base-selector";
import { UploadedFile } from "@/utils/upload-service";
import { Asset, KnowledgeBase } from "@/types/knowledge-base";
import { useSession } from '@/app/utils/session/session';
import { fetchKnowledgeBases } from '@/utils/knowledge-base-service';
import { useEffect } from 'react';

interface SourceSelectorProps {
  onFileUpload: (file: UploadedFile) => void;
  onAssetSelect: (assets: Asset[]) => void;
  onKnowledgeBaseSelect: (kbs: KnowledgeBase[]) => void;
  selectedAssets: Asset[];
  selectedKnowledgeBases: KnowledgeBase[];
  uploadedFiles: UploadedFile[];
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

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
          <TabsTrigger value="select">Select Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <AssetUploader
            onUploadComplete={(files) => {
              files.forEach(file => onFileUpload(file));
            }}
          />
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