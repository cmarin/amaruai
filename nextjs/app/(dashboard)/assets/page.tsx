'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/components/sidebar-context';
import { useSession } from '@/app/utils/session/session';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { useToast } from "@/hooks/use-toast";
import { AppSidebar } from '@/components/app-sidebar';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ImageIcon, FileTextIcon, FileIcon as LucideFileIcon, Upload, Copy, Settings, Trash2, MoreHorizontal, BookOpen, Plus, X, Search } from 'lucide-react';
import { Asset } from '@/types/knowledge-base';
import { fetchAssets, deleteAsset } from '@/utils/asset-service';
import { UploadService, UploadedFile } from '@/utils/upload-service';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatFileSize, getFileExtension } from '@/lib/utils';
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

function getAssetIcon(type: string) {
  const extension = getFileExtension(type);
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return <ImageIcon className="h-4 w-4" />;
    case 'pdf':
      return <FileTextIcon className="h-4 w-4" />;
    default:
      return <LucideFileIcon className="h-4 w-4" />;
  }
}

function getAssetStatus(asset: Asset) {
  if (!asset.managed) {
    return {
      label: 'Unmanaged',
      color: 'text-gray-500'
    };
  }
  return {
    label: 'Managed',
    color: 'text-green-500'
  };
}

interface AssetRowProps {
  asset: Asset;
  onDelete: (id: string) => void;
}

function AssetRow({ asset, onDelete }: AssetRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(asset.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <TableRow key={asset.id}>
      <TableCell>
        {getAssetIcon(asset.type)}
      </TableCell>
      <TableCell>
        <a 
          href={asset.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800"
        >
          {asset.title || asset.file_name}
        </a>
      </TableCell>
      <TableCell>{formatFileSize(asset.size || 0)}</TableCell>
      <TableCell>
        <span className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
          asset.managed ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
        )}>
          {asset.managed ? 'Managed' : 'Unmanaged'}
        </span>
      </TableCell>
      <TableCell>
        {new Date(asset.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <div className="flex gap-1 justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy transcript</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(asset.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete asset</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AssetsPage() {
  const { sidebarOpen } = useSidebar();
  const { getApiHeaders } = useSession();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof Asset>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = useSupabase();
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uppy, setUppy] = useState<Uppy | null>(null);
  const itemsPerPage = 10;
  const router = useRouter();

  const handleSort = (key: keyof Asset) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const filteredAssets = assets.filter(asset => 
    asset.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.file_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];
    const order = sortOrder === 'asc' ? 1 : -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue) * order;
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * order;
    }
    if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      return (aValue === bValue ? 0 : aValue ? 1 : -1) * order;
    }
    return 0;
  });

  const totalPages = Math.ceil(sortedAssets.length / itemsPerPage);
  const currentAssets = sortedAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const loadAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const headers = getApiHeaders();
      if (!headers) return;
      const data = await fetchAssets(headers);
      setAssets(data);
    } catch (err) {
      console.error('Error loading assets:', err);
      setError('Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  }, [getApiHeaders]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!supabase) return;

    const uppyInstance = UploadService.createUppy(
      'asset-uploader',
      {
        maxFiles: 10,
        storageFolder: 'assets',
      },
      (file) => {
        setUploadedFiles(prev => [...prev, file]);
      },
      async (result) => {
        try {
          const headers = getApiHeaders();
          if (!headers) return;

          await loadAssets();
          setShowUploadModal(false);
          toast({
            title: "Success",
            description: "Assets uploaded successfully",
          });
        } catch (error) {
          console.error('Error handling upload:', error);
          toast({
            title: "Error",
            description: "Failed to process uploaded assets",
            variant: "destructive",
          });
        }
      },
      supabase
    );

    setUppy(uppyInstance);

    return () => {
      if (uppyInstance) {
        const allFileIds = uppyInstance.getFiles().map(file => file.id);
        uppyInstance.cancelAll();
        uppyInstance.removeFiles(allFileIds);
        uppyInstance.destroy();
      }
    };
  }, [supabase, getApiHeaders, loadAssets, toast]);

  const handleDeleteAsset = async (assetId: string) => {
    try {
      const headers = getApiHeaders();
      if (!headers) return;
      await deleteAsset(assetId, headers);
      await loadAssets();
      toast({
        title: "Success",
        description: "Asset deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast({
        title: "Error",
        description: "Failed to delete asset",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="flex h-screen">
      <AppSidebar toggleChatbot={() => {}} />
      <div className={`flex-1 p-6 overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Assets</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => router.push('/knowledge-bases')}
              className="h-9"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Manage Knowledge Bases
            </Button>
            <Button 
              onClick={() => setShowUploadModal(true)} 
              className="bg-blue-600 hover:bg-blue-700 text-white h-9"
            >
              <Plus className="mr-2 h-4 w-4" />
              Upload Assets
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead 
                    className="w-[300px] cursor-pointer"
                    onClick={() => handleSort('title')}
                  >
                    Title {sortKey === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="w-[100px] cursor-pointer"
                    onClick={() => handleSort('size')}
                  >
                    Size {sortKey === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="w-[100px] cursor-pointer"
                    onClick={() => handleSort('managed')}
                  >
                    Status {sortKey === 'managed' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="w-[120px] cursor-pointer"
                    onClick={() => handleSort('created_at')}
                  >
                    Created {sortKey === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentAssets.map((asset) => (
                  <AssetRow 
                    key={asset.id} 
                    asset={asset} 
                    onDelete={handleDeleteAsset}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                        onClick={() => setCurrentPage(pageNum)}
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
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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

        {/* Upload Modal */}
        {showUploadModal && uppy && (
          <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload Assets</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Dashboard 
                  uppy={uppy} 
                  plugins={[]} 
                  proudlyDisplayPoweredByUppy={false}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}