'use client';

import { Asset } from '@/types/knowledge-base';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { Button } from "@/components/ui/button";
import { Copy, Check, Plus, Eye, Settings, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface AssetsTableProps {
  assets: Asset[];
  onDeleteAsset?: (assetId: string) => void;
  onManageAsset?: (asset: Asset) => void;
  onPreview?: (asset: Asset) => void;
  onSelectAsset?: (asset: Asset) => void;
  showActions?: boolean;
  showStatus?: boolean;
  actionType?: 'manage' | 'select';
  className?: string;
  searchQuery?: string;
  currentPage?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  totalItems?: number;
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
  onSelectAsset,
  showActions = true,
  showStatus = true,
  actionType = 'manage',
  className,
  searchQuery = '',
  currentPage = 1,
  itemsPerPage = 10,
  onPageChange,
  totalItems
}: AssetsTableProps) {
  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);

  const handleCopyTranscript = async (content: string | undefined | null, assetId: string) => {
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

  const filteredAssets = assets.filter(asset => 
    asset.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.file_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = totalItems ? Math.ceil(totalItems / itemsPerPage) : 
    Math.ceil(filteredAssets.length / itemsPerPage);

  return (
    <div className="w-full space-y-4">
      <div className="overflow-x-auto">
        <Table className={className}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[300px]">Title</TableHead>
              <TableHead className="w-[100px]">Size</TableHead>
              <TableHead className="w-[120px]">Created</TableHead>
              {showActions && (
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions ? 5 : 4} className="h-24 text-center">
                  No assets found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow key={asset.id}>
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
                  <TableCell>{formatFileSize(asset.size || 0)}</TableCell>
                  <TableCell>
                    {new Date(asset.created_at).toLocaleDateString()}
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {actionType === 'manage' ? (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleCopyTranscript(asset.content, asset.id)}
                                  >
                                    <span className="sr-only">Copy transcript</span>
                                    <Copy className={cn("h-4 w-4", copiedAssetId === asset.id && "text-green-500")} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{copiedAssetId === asset.id ? 'Copied!' : 'Copy transcript'}</p>
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
                          </>
                        ) : (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleCopyTranscript(asset.content, asset.id)}
                                  >
                                    <span className="sr-only">Copy transcript</span>
                                    <Copy className={cn("h-4 w-4", copiedAssetId === asset.id && "text-green-500")} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{copiedAssetId === asset.id ? 'Copied!' : 'Copy transcript'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="flex items-center gap-2 px-3"
                                    onClick={() => onSelectAsset?.(asset)}
                                  >
                                    <Plus className="h-4 w-4" />
                                    Add
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Add to Knowledge Base</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
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
      {totalPages > 1 && onPageChange && (
        <div className="flex justify-center mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else {
                  if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - (4 - i);
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                }
                return (
                  <PaginationItem key={pageNum}>
                    <Button
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(pageNum)}
                      className="min-w-[2.5rem]"
                    >
                      {pageNum}
                    </Button>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}