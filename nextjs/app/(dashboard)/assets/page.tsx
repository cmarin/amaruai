'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
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
import { Plus, ChevronUp, ChevronDown } from 'lucide-react'

// ... rest of your provided code ...

export default function AssetsPage() {
  const { sidebarOpen } = useSidebar();
  // ... rest of your existing code ...

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={(modelId: string) => {}} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 p-8 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          {/* Your existing JSX here */}
          <header className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Assets</h1>
            <div className="flex gap-3">
              <Link href="/knowledge-bases">
                <Button variant="outline">
                  Manage Knowledge Bases
                </Button>
              </Link>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Asset
              </Button>
            </div>
          </header>

          {/* Rest of your existing JSX */}
        </div>
      </div>
    </div>
  );
} 