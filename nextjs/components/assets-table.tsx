'use client';

import { Asset } from '@/types/knowledge-base';
import { formatFileSize } from '@/lib/utils';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { Button } from "@/components/ui/button";
import { Copy, Check, Trash2, Settings, Plus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from 'react';

interface AssetsTableProps {
  assets: Asset[];
  onDeleteAsset?: (assetId: string) => void;
  onManageAsset?: (asset: Asset) => void;
  showActions?: boolean;
}

export function AssetsTable({ 
  assets, 
  onDeleteAsset, 
  onManageAsset,
  showActions = true 
}: AssetsTableProps) {
  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);

  const handleCopyTranscript = async (content: string, assetId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedAssetId(assetId);
      setTimeout(() => setCopiedAssetId(null), 2000);
    } catch (error) {
      console.error('Error copying transcript:', error);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]"></TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          {showActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell className="w-[40px]">
              <div className="w-8">
                <FileIcon 
                  extension={asset.file_type.toLowerCase()}
                  {...defaultStyles[asset.file_type.toLowerCase()]}
                />
              </div>
            </TableCell>
            <TableCell>
              <span className="font-medium">{asset.title || asset.file_name}</span>
            </TableCell>
            <TableCell>{asset.mime_type}</TableCell>
            <TableCell>{formatFileSize(asset.size)}</TableCell>
            <TableCell>
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                asset.managed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {asset.status || (asset.managed ? 'Managed' : 'Unmanaged')}
              </div>
            </TableCell>
            <TableCell>
              {new Date(asset.created_at).toLocaleDateString()}
            </TableCell>
            {showActions && (
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCopyTranscript(asset.content, asset.id)}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    {copiedAssetId === asset.id ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    Transcript
                  </Button>
                  {onManageAsset && !asset.managed && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onManageAsset(asset)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  )}
                  {onDeleteAsset && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onDeleteAsset(asset.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 