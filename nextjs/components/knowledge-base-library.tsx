'use client';

import { useState } from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Edit, Trash2, FileText, LayoutGrid, List } from 'lucide-react'
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import KnowledgeBaseManager from '@/components/knowledge-base-manager';
import { KnowledgeBase, deleteKnowledgeBase } from '@/utils/knowledge-base-service'
import { useSession } from '@/app/utils/session/session';
import { useRouter } from 'next/navigation';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination"

type KnowledgeBaseLibraryProps = {
  knowledgeBases: KnowledgeBase[];
  onUpdateKnowledgeBases: () => Promise<void>;
}

type ViewMode = 'grid' | 'table';

export function KnowledgeBaseLibrary({ knowledgeBases, onUpdateKnowledgeBases }: KnowledgeBaseLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const { getApiHeaders } = useSession();
  const router = useRouter();

  const filteredKnowledgeBases = knowledgeBases.filter(kb =>
    kb.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    kb.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredKnowledgeBases.length / itemsPerPage)
  const paginatedKnowledgeBases = viewMode === 'table'
    ? filteredKnowledgeBases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredKnowledgeBases

  const handleCreateKnowledgeBase = () => {
    router.push('/knowledge-bases/create');
  }

  const handleEditKnowledgeBase = (knowledgeBase: KnowledgeBase) => {
    router.push(`/knowledge-bases/${knowledgeBase.id}`);
  }

  const handleDeleteKnowledgeBase = async (id: string) => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      
      await deleteKnowledgeBase(id, headers);
      await onUpdateKnowledgeBases();
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
    }
  }

  const handleSaveKnowledgeBase = async () => {
    try {
      await onUpdateKnowledgeBases()
      setSelectedKnowledgeBase(null)
      setIsCreating(false)
    } catch (error) {
      console.error('Error saving knowledge base:', error)
    }
  }

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {paginatedKnowledgeBases.length > 0 ? (
        paginatedKnowledgeBases.map((kb) => (
          <Card key={kb.id} className="flex flex-col">
            <CardContent className="flex-grow p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{kb.title}</h3>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEditKnowledgeBase(kb)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-100">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDeleteKnowledgeBase(kb.id)} 
                    className="text-red-500 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm mb-4">{kb.description}</p>
            </CardContent>
            <CardFooter className="border-t p-4">
              <div className="text-sm text-gray-500">
                {kb.assets.length} asset{kb.assets.length !== 1 ? 's' : ''} linked
              </div>
            </CardFooter>
          </Card>
        ))
      ) : (
        <div className="col-span-full text-center text-gray-500">No knowledge bases found</div>
      )}
    </div>
  )

  const renderTableView = () => (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Assets</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedKnowledgeBases.map((kb) => (
            <TableRow key={kb.id}>
              <TableCell>
                <div className="font-medium">{kb.title}</div>
              </TableCell>
              <TableCell>{kb.description}</TableCell>
              <TableCell>
                {kb.assets.length} asset{kb.assets.length !== 1 ? 's' : ''}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditKnowledgeBase(kb)}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteKnowledgeBase(kb.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {viewMode === 'table' && totalPages > 1 && (
        <div className="mt-4 flex justify-center">
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
                  <Button
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
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
  )

  if (selectedKnowledgeBase || isCreating) {
    return (
      <KnowledgeBaseManager
        knowledgeBase={selectedKnowledgeBase}
        onSave={handleSaveKnowledgeBase}
        onClose={() => {
          setSelectedKnowledgeBase(null)
          setIsCreating(false)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-900 dark:border-gray-700">
        <h1 className="text-2xl font-bold">Knowledge Bases</h1>
        <div className="flex items-center justify-end w-[500px] gap-4">
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('table')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/assets">
              <Button variant="outline" className="whitespace-nowrap">
                <FileText className="mr-2 h-4 w-4" />
                Manage Assets
              </Button>
            </Link>
            <Button onClick={handleCreateKnowledgeBase} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" />
              New Knowledge Base
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4">
        <Input
          type="search"
          placeholder="Search knowledge bases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm mb-4"
        />
      </div>
      <ScrollArea className="flex-grow">
        {viewMode === 'grid' ? renderGridView() : renderTableView()}
      </ScrollArea>
    </div>
  )
}