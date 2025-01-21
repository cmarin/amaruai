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
import { ImageIcon, FileTextIcon, FileIcon as LucideFileIcon, Upload, Copy, Settings, Trash2 } from 'lucide-react';
import { Asset } from '@/types/knowledge-base';
import { fetchAssets, deleteAsset } from '@/utils/asset-service';
import { UploadService } from '@/utils/upload-service';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function formatBytes(size: number | undefined) {
  if (!size) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function getAssetTypeIcon(asset: Asset) {
  switch (asset.type.toLowerCase()) {
    case 'image':
      return <ImageIcon className="h-4 w-4" />;
    case 'pdf':
      return <FileTextIcon className="h-4 w-4" />;
    case 'document':
      return <LucideFileIcon className="h-4 w-4" />;
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
          {getAssetTypeIcon(asset)}
        </div>
      </TableCell>
      <TableCell>
        <span className="font-medium">{asset.title}</span>
      </TableCell>
      <TableCell>{asset.type}</TableCell>
      <TableCell>{formatBytes(asset.size)}</TableCell>
      <TableCell>
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          asset.managed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {getAssetStatus(asset).label}
        </div>
      </TableCell>
      <TableCell>
        {new Date(asset.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-gray-600 hover:text-gray-700"
          >
            <Copy className="h-4 w-4 mr-1" />
            View
          </Button>
          {!asset.managed && (
            <Button 
              variant="outline" 
              size="sm"
            >
              <Settings className="h-4 w-4 mr-1" />
              Manage
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onDelete(asset.id)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
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
  const supabase = useSupabase();
  const { toast } = useToast();
  const uppyRef = useRef<Uppy | null>(null);
  const itemsPerPage = 10;

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
    <div className="flex h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto py-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-semibold">Assets</h1>
              <Button onClick={() => setShowUploadModal(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Asset
              </Button>
            </div>

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