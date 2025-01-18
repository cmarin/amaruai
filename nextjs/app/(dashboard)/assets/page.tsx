'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { useSession } from '@/app/utils/session/session';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { UploadService, type UploadedFile } from '@/utils/upload-service';
import { fetchAssets, deleteAsset } from '@/utils/asset-service';
import { Asset } from '@/types/knowledge-base';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, ExternalLink, Settings, BookOpen, Trash2, Check, Copy } from 'lucide-react';
import { Dashboard } from '@uppy/react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileIcon, defaultStyles } from 'react-file-icon';
import { formatFileSize } from '@/lib/utils';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";

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
  const router = useRouter();
  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      console.log('Fetching assets...');
      const fetchedAssets = await fetchAssets(headers);
      console.log('Fetched assets:', fetchedAssets);
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

  // Initial load of assets
  useEffect(() => {
    loadAssets();
  }, [loadAssets]); // Include loadAssets in dependencies since it's stable due to useCallback

  // Sort and paginate assets
  const sortedAssets = React.useMemo(() => {
    return [...assets].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortOrder === 'asc' ? -1 : 1;
      if (bValue == null) return sortOrder === 'asc' ? 1 : -1;

      // Special handling for dates
      if (sortKey === 'created_at' || sortKey === 'updated_at') {
        const aDate = new Date(aValue as string).getTime();
        const bDate = new Date(bValue as string).getTime();
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Handle number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Fallback to string comparison
      return sortOrder === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [assets, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedAssets.length / assetsPerPage);
  const currentAssets = sortedAssets.slice(
    (currentPage - 1) * assetsPerPage,
    currentPage * assetsPerPage
  );

  const handleSort = (key: keyof Asset) => {
    setSortKey(key);
    setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
  };

  const handleManageAsset = async (assetId: string) => {
    try {
      const headers = getApiHeaders();
      if (!headers) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assets/${assetId}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ managed: true }),
      });

      if (!response.ok) throw new Error('Failed to manage asset');

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

  // Initialize Uppy
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
          if (!headers) return;

          // Update assets after upload
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

    return () => {
      if (uppyRef.current) {
        uppyRef.current.cancelAll();
      }
    };
  }, [supabase, getApiHeaders, loadAssets, toast]);

  const handleCopyTranscript = async (content: string, assetId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedAssetId(assetId);
      toast({
        title: "Success",
        description: "Transcript copied to clipboard",
      });
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedAssetId(null), 2000);
    } catch (error) {
      console.error('Error copying transcript:', error);
      toast({
        title: "Error",
        description: "Failed to copy transcript",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={() => {}} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
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

          <div className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-lg text-gray-500">Loading assets...</div>
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-lg text-gray-500 mb-4">No assets found</div>
                <Button onClick={() => setShowUploadModal(true)} variant="outline">
                  Upload some assets to get started
                </Button>
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
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteAsset(asset.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
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
                  <Button variant="ghost" size="icon" onClick={() => setShowUploadModal(false)}>
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