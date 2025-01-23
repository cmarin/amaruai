'use client';

import { Asset } from '@/types/knowledge-base';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { Button } from "@/components/ui/button";
import { Copy, Check, Trash2, Settings, Plus, Eye } from 'lucide-react';
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
import { Badge } from "@/components/ui/badge";

interface AssetsTableProps {
  assets: Asset[];
  onDeleteAsset?: (assetId: string) => void;
  onManageAsset?: (asset: Asset) => void;
  onPreview?: (asset: Asset) => void;
  showActions?: boolean;
  className?: string;
}

const getFileExtension = (type: string) => {
  if (!type) return 'txt';
  const parts = type.split('/');
  return parts[parts.length - 1].toLowerCase();
};

export function AssetsTable({ 
  assets, 
  onDeleteAsset, 
  onManageAsset,
  onPreview,
  showActions = true,
  className
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

  const formatFileSize = (size: number) => {
    if (size < 1024) {
      return `${size} bytes`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <Table className={className}>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[300px]">Title</TableHead>
              <TableHead className="w-[150px]">Type</TableHead>
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
                        extension={getFileExtension(asset.type || asset.mime_type || '')} 
                        {...defaultStyles[getFileExtension(asset.type || asset.mime_type || '')]} 
                      />
                    </div>
                  </TableCell>
                  <TableCell className="truncate">
                    <a 
                      href={asset.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 truncate block"
                    >
                      {asset.title || asset.file_name}
                    </a>
                  </TableCell>
                  <TableCell className="truncate">
                    {asset.mime_type || asset.type || 'Unknown'}
                  </TableCell>
                  <TableCell>{formatFileSize(asset.size || 0)}</TableCell>
                  <TableCell>
                    <Badge variant={asset.managed ? "default" : "secondary"}>
                      {asset.managed ? "Managed" : "External"}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(asset.created_at).toLocaleDateString()}</TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => onPreview?.(asset)}
                              >
                                <span className="sr-only">Preview asset</span>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Preview asset</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {onManageAsset && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => onManageAsset(asset)}
                                >
                                  <span className="sr-only">Manage asset</span>
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Manage asset</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {onDeleteAsset && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => onDeleteAsset(asset.id)}
                                >
                                  <span className="sr-only">Delete asset</span>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete asset</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 