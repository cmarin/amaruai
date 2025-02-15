import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetUploader } from "@/components/asset-uploader";
import { UploadedFile } from "@/utils/upload-service";
import { Asset, KnowledgeBase } from "@/types/knowledge-base";

interface SourceSelectorProps {
  onFileUpload: (file: UploadedFile) => void;
  onAssetSelect: (assets: Asset[]) => void;
  onKnowledgeBaseSelect: (kbs: KnowledgeBase[]) => void;
  selectedAssets: Asset[];
  selectedKnowledgeBases: KnowledgeBase[];
  uploadedFiles: UploadedFile[];
  onUploadComplete?: () => void;
}

export function SourceSelector({
  onFileUpload,
  onAssetSelect,
  onKnowledgeBaseSelect,
  selectedAssets,
  selectedKnowledgeBases,
  uploadedFiles,
  onUploadComplete
}: SourceSelectorProps) {
  const [activeTab, setActiveTab] = useState("upload");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <AssetUploader
            onUploadComplete={(files) => {
              files.forEach(file => onFileUpload(file));
              if (onUploadComplete) {
                onUploadComplete();
              }
            }}
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
        </div>
      </div>
    </div>
  );
} 