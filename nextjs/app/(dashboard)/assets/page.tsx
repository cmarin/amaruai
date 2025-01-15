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

// ... rest of your provided code ...

export default function AssetsPage() {
  const { sidebarOpen } = useSidebar();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const { getApiHeaders } = useSession();
  const supabase = useSupabase();
  const uppyRef = useRef<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    // Initialize Uppy
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
        // Handle upload complete
        setShowUploadModal(false);
        // Refresh assets list
        // await fetchAssets();
      },
      supabase
    );

    return () => {
      if (uppyRef.current) {
        uppyRef.current.close();
      }
    };
  }, [supabase]);

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    if (uppyRef.current) {
      uppyRef.current.cancelAll();
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

          {/* Rest of your table code */}

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