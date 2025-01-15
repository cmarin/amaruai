'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { useSession } from '@/app/utils/session/session'
import { Asset } from '@/types/knowledge-base'
import { UploadedFile, UploadService } from '@/utils/upload-service'
import { useSupabase } from '@/app/contexts/SupabaseContext'
import { Dashboard } from '@uppy/react'
import type { UppyFile } from '@uppy/core'
import { X, Plus, ExternalLink, Settings } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { fetchAssets } from '@/utils/asset-service'
import { useToast } from "@/hooks/use-toast"
import { formatFileSize } from '@/lib/utils'
import type { FileIconProps } from 'react-file-icon';
import { FileIcon, defaultStyles } from 'react-file-icon'

interface UppyResponse {
  body?: Record<string, unknown>;
  status: number;
  bytesUploaded?: number;
  uploadURL?: string;
  id: string;
}

interface UploadedUppyFile extends UppyFile<Record<string, unknown>, Record<string, unknown>> {
  response?: UppyResponse;
}

export default function AssetsPage() {
  const { sidebarOpen } = useSidebar();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const { getApiHeaders } = useSession();
  const supabase = useSupabase();
  const uppyRef = useRef<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState<keyof Asset>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const assetsPerPage = 10;

  const loadAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      const fetchedAssets = await fetchAssets(headers);
      setAssets(fetchedAssets || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast({
        title: "Error",
        description: "Failed to load assets",
        variant: "destructive",
      });
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  }, [getApiHeaders, toast]);

  useEffect(() => {
    setAssets([]);
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    uppyRef.current = UploadService.createUppy(
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
          if (!headers) {
            console.error('No valid headers available');
            return;
          }

          const updatePromises = result.successful.map(async (file: UploadedUppyFile) => {
            if (!file.response?.id) {
              console.error('No file ID in response');
              return;
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assets/${file.response.id}`, {
              method: 'PATCH',
              headers: {
                ...headers,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                managed: true
              }),
            });

            if (!response.ok) {
              throw new Error(`Failed to update asset managed status: ${response.statusText}`);
            }

            return response.json();
          });

          await Promise.all(updatePromises);
          setShowUploadModal(false);
          await loadAssets();
          toast({
            title: "Success",
            description: "Assets uploaded successfully",
          });
        } catch (error) {
          console.error('Error updating asset managed status:', error);
          toast({
            title: "Error",
            description: "Failed to update asset status",
            variant: "destructive",
          });
        }
      },
      supabase
    );

    // Cleanup function
    return () => {
      if (uppyRef.current) {
        uppyRef.current.cancelAll();
        // Remove any event listeners
        uppyRef.current.off();
      }
    };
  }, [supabase, getApiHeaders, toast]);

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    if (uppyRef.current) {
      uppyRef.current.cancelAll();
      uppyRef.current.reset();
    }
  };

  // Sort and paginate assets
  const sortedAssets = useMemo(() => {
    if (!Array.isArray(assets)) return [];
    
    return [...assets].sort((a, b) => {
      const aValue = a?.[sortKey];
      const bValue = b?.[sortKey];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortOrder === 'asc' ? -1 : 1;
      if (bValue == null) return sortOrder === 'asc' ? 1 : -1;

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [assets, sortKey, sortOrder]);

  const currentAssets = useMemo(() => {
    const indexOfLastAsset = currentPage * assetsPerPage;
    const indexOfFirstAsset = indexOfLastAsset - assetsPerPage;
    return sortedAssets.slice(indexOfFirstAsset, indexOfLastAsset);
  }, [sortedAssets, currentPage, assetsPerPage]);

  const totalPages = useMemo(() => 
    Math.ceil(sortedAssets.length / assetsPerPage)
  , [sortedAssets.length, assetsPerPage]);

  const handleSort = (key: keyof Asset) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleManageAsset = async (assetId: string) => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assets/${assetId}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          managed: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update asset');
      }

      await loadAssets();
      toast({
        title: "Success",
        description: "Asset is now managed",
      });
    } catch (error) {
      console.error('Error managing asset:', error);
      toast({
        title: "Error",
        description: "Failed to manage asset",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={(modelId: string) => {}} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 p-8 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <header className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Assets</h1>
            <div className="flex gap-3">
              <Link href="/knowledge-bases">
                <Button variant="outline">
                  Manage Knowledge Bases
                </Button>
              </Link>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setShowUploadModal(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Asset
              </Button>
            </div>
          </header>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No assets found. Upload some assets to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort('title')}
                    >
                      Title {sortKey === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort('file_type')}
                    >
                      Type {sortKey === 'file_type' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort('size')}
                    >
                      Size {sortKey === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => handleSort('status')}
                    >
                      Status {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                        <div className="flex flex-col">
                          <span className="font-medium">{asset.title || asset.file_name}</span>
                          <span className="text-sm text-gray-500">{asset.file_name}</span>
                        </div>
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
                        {new Date(asset.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </a>
                          </Button>
                          {!asset.managed && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleManageAsset(asset.id)}
                            >
                              <Settings className="h-4 w-4 mr-1" />
                              Manage
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Show pagination only if we have assets */}
          {assets.length > 0 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {/* File upload modal */}
          {showUploadModal && uppyRef.current && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-4 rounded-lg max-w-2xl w-full">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Upload Assets</h2>
                  <Button variant="ghost" size="icon" onClick={handleCloseUploadModal}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Dashboard 
                  uppy={uppyRef.current} 
                  plugins={[]} 
                  proudlyDisplayPoweredByUppy={false}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 