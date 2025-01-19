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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      if (!content) {
        console.error('No content available to copy');
        return;
      }
      await navigator.clipboard.writeText(content);
      setCopiedAssetId(assetId);
      setTimeout(() => setCopiedAssetId(null), 2000);
    } catch (error) {
      console.error('Error copying transcript:', error);
    }
  };

  return (
    <div className="w-full overflow-auto bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="w-[40px]"></TableHead>
            <TableHead className="min-w-[200px]">Title</TableHead>
            <TableHead className="w-[120px]">Type</TableHead>
            <TableHead className="w-[100px]">Size</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Created</TableHead>
            {showActions && (
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.length === 0 ? (
            <TableRow className="hover:bg-gray-50">
              <TableCell colSpan={showActions ? 7 : 6} className="h-24 text-center">
                No assets found.
              </TableCell>
            </TableRow>
          ) : (
            assets.map((asset) => (
              <TableRow key={asset.id} className="hover:bg-gray-50">
                <TableCell className="w-[40px]">
                  <div className="w-8 h-8">
                    <FileIcon 
                      extension={asset.file_type.split('/')[1]} 
                      {...defaultStyles[asset.file_type.split('/')[1]]} 
                    />
                  </div>
                </TableCell>
                <TableCell className="font-medium truncate max-w-[200px]">
                  {asset.title || asset.file_name}
                </TableCell>
                <TableCell>{asset.mime_type}</TableCell>
                <TableCell>{formatFileSize(asset.size)}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${asset.managed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                    {asset.status || (asset.managed ? 'Managed' : 'Unmanaged')}
                  </span>
                </TableCell>
                <TableCell>{new Date(asset.created_at).toLocaleDateString()}</TableCell>
                {showActions && (
                  <TableCell className="text-right space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleCopyTranscript(asset.content || '', asset.id)}
                            className="h-8 w-8 text-gray-600 hover:text-gray-700"
                          >
                            {copiedAssetId === asset.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy transcript</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {onManageAsset && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => onManageAsset(asset)}
                        className="h-8 w-8"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                    {onDeleteAsset && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => onDeleteAsset(asset.id)}
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
} 