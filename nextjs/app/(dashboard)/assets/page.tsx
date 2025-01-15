'use client'

import { useState, useEffect, useRef } from 'react'
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
import { X, Plus } from 'lucide-react'
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
  const assetsPerPage = 10;

  const loadAssets = async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      const fetchedAssets = await fetchAssets(headers);
      setAssets(fetchedAssets);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast({
        title: "Error",
        description: "Failed to load assets",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

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

    return () => {
      if (uppyRef.current) {
        uppyRef.current.close();
      }
    };
  }, [supabase, getApiHeaders, toast]);

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    if (uppyRef.current) {
      uppyRef.current.cancelAll();
    }
  };

  // Sort and paginate assets
  const sortedAssets = [...assets].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortOrder === 'asc' ? -1 : 1;
    if (bValue == null) return sortOrder === 'asc' ? 1 : -1;

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const indexOfLastAsset = currentPage * assetsPerPage;
  const indexOfFirstAsset = indexOfLastAsset - assetsPerPage;
  const currentAssets = sortedAssets.slice(indexOfFirstAsset, indexOfLastAsset);
  const totalPages = Math.ceil(sortedAssets.length / assetsPerPage);

  const handleSort = (key: keyof Asset) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('file_name')}
                  >
                    Name {sortKey === 'file_name' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                    onClick={() => handleSort('created_at')}
                  >
                    Created At {sortKey === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>{asset.file_name}</TableCell>
                    <TableCell>{asset.file_type}</TableCell>
                    <TableCell>{(asset.size / 1024).toFixed(2)} KB</TableCell>
                    <TableCell>{new Date(asset.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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