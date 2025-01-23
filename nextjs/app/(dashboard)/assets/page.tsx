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
import { ImageIcon, FileTextIcon, FileIcon as LucideFileIcon, Upload, Copy, Settings, Trash2, MoreHorizontal, BookOpen, Plus } from 'lucide-react';
import { Asset } from '@/types/knowledge-base';
import { fetchAssets, deleteAsset } from '@/utils/asset-service';
import { UploadService } from '@/utils/upload-service';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatFileSize, getFileExtension } from '@/lib/utils';

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

function AssetRow({ asset, onDelete }: { asset: Asset; onDelete: (id: string) => void }) {
  return (
    <TableRow key={asset.id}>
      <TableCell className="w-[40px]">
        <div className="w-8">
          {getAssetIcon(asset.type || asset.mime_type || '')}
        </div>
      </TableCell>
      <TableCell>
        <span className="font-medium">{asset.title || ''}</span>
      </TableCell>
      <TableCell>{asset.mime_type || asset.type || 'Unknown'}</TableCell>
      <TableCell>{formatFileSize(asset.size || 0)}</TableCell>
      <TableCell>
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          asset.managed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {asset.managed ? 'Managed' : 'Unmanaged'}
        </div>
      </TableCell>
      <TableCell>
        {new Date(asset.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>
              <Copy className="mr-2 h-4 w-4" />
              <span>Copy ID</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Edit</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={() => onDelete(asset.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
  const supabase = useSupabase();
  const { toast } = useToast();
  const uppyRef = useRef<Uppy | null>(null);
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

  const sortedAssets = [...assets].sort((a, b) => {
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
    if (!uppyRef.current && supabase) {
      uppyRef.current = UploadService.createUppy(
        'asset-uploader',
        {
          maxFiles: 10,
          storageFolder: 'assets',
        },
        async (file) => {
          await loadAssets();
        },
        async () => {
          await loadAssets();
          setShowUploadModal(false);
          toast({
            title: "Success",
            description: "Assets uploaded successfully",
          });
        },
        supabase
      );
    }

    return () => {
      if (uppyRef.current) {
        uppyRef.current.cancelAll();
      }
    };
  }, [supabase, loadAssets, toast]);

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
    <div className="flex h-full w-full overflow-hidden bg-white">
      <AppSidebar toggleChatbot={() => {}} />
      <div className={`flex-1 flex flex-col overflow-hidden ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-2xl font-bold">Assets</h1>
          <div className="flex gap-3">
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
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto py-6">
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort('title')}
                    >
                      Name {sortKey === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort('type')}
                    >
                      Type {sortKey === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort('size')}
                    >
                      Size {sortKey === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort('managed')}
                    >
                      Status {sortKey === 'managed' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort('created_at')}
                    >
                      Created {sortKey === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead>Actions</TableHead>
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

              {totalPages > 1 && (
                <div className="py-4 px-6 border-t">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showUploadModal} onOpenChange={(open) => {
        setShowUploadModal(open);
        if (!open && uppyRef.current) {
          const uppy = uppyRef.current;
          uppy.cancelAll();
        }
      }}>
        <DialogContent className="max-w-4xl bg-white">
          <DialogHeader className="bg-white">
            <DialogTitle className="text-gray-900">Upload Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4 bg-white min-h-[400px]">
            {uppyRef.current && (
              <Dashboard
                uppy={uppyRef.current}
                showProgressDetails
                hideUploadButton={false}
                height={350}
                width="100%"
                proudlyDisplayPoweredByUppy={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}