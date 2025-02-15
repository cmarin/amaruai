import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetUploader } from "@/components/asset-uploader";
import { AssetLibrary } from "@/components/asset-library";
import { KnowledgeBaseLibrary } from "@/components/knowledge-base-library";
import { UploadedFile } from "@/utils/upload-service";
import { Asset } from "@/types/knowledge-base";
import { KnowledgeBase } from "@/types/knowledge-base";

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

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
          <TabsTrigger value="assets">Select Assets</TabsTrigger>
          <TabsTrigger value="knowledge-bases">Knowledge Bases</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <AssetUploader
            onUploadComplete={(files) => {
              files.forEach(file => onFileUpload(file));
            }}
          />
        </TabsContent>

        <TabsContent value="assets">
          <AssetLibrary
            selectedAssets={selectedAssets}
            onAssetSelect={onAssetSelect}
            multiSelect={true}
          />
        </TabsContent>

        <TabsContent value="knowledge-bases">
          <KnowledgeBaseLibrary
            selectedKnowledgeBases={selectedKnowledgeBases}
            onKnowledgeBaseSelect={onKnowledgeBaseSelect}
            multiSelect={true}
          />
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
                  <li key={asset.id}>{asset.name}</li>
                ))}
              </ul>
            </div>
          )}
          
          {selectedKnowledgeBases.length > 0 && (
            <div>
              <h4 className="font-medium">Selected Knowledge Bases:</h4>
              <ul className="list-disc pl-5">
                {selectedKnowledgeBases.map(kb => (
                  <li key={kb.id}>{kb.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 