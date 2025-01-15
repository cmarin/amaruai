'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AssetUploader } from "@/components/asset-uploader"
import { UploadedFile } from "@/utils/upload-service"

interface AssetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: (files: UploadedFile[]) => void;
}

export function AssetUploadDialog({ 
  open, 
  onOpenChange,
  onUploadComplete 
}: AssetUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Assets</DialogTitle>
        </DialogHeader>
        <AssetUploader 
          onUploadComplete={(files) => {
            if (onUploadComplete) {
              onUploadComplete(files);
            }
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  )
} 