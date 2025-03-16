'use client';

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Edit, Trash2, LayoutGrid, List, Code, Star } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem
} from "@/components/ui/pagination"
import { PromptTemplate } from '@/utils/prompt-template-service'
import type { PromptContent } from '@/components/complex-prompt-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PromptTemplateFilters } from './prompt-template-filters'
import { useSession } from '@/app/utils/session/session'

type PromptTemplateLibraryProps = {
  prompts: PromptTemplate[];
  onEdit: (prompt: PromptTemplate) => void;
  onDelete: (prompt: PromptTemplate) => void;
  onNewSimple: () => void;
  onNewComplex: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (value: string | null) => void;
  categories: string[];
  onFavoriteToggle: (prompt: PromptTemplate) => void;
  onUpdateFilters: (filters: any) => void;
};

type ViewMode = 'grid' | 'table';

type SortOption = {
  label: string;
  value: string;
  sort_by: 'created_at' | 'updated_at' | 'title';
  sort_order: 'asc' | 'desc';
};

const sortOptions: SortOption[] = [
  { label: 'Creation Date (Newest)', value: 'created_desc', sort_by: 'created_at', sort_order: 'desc' },
  { label: 'Creation Date (Oldest)', value: 'created_asc', sort_by: 'created_at', sort_order: 'asc' },
  { label: 'Last Updated', value: 'updated_desc', sort_by: 'updated_at', sort_order: 'desc' },
  { label: 'Alphabetical (A-Z)', value: 'alpha_asc', sort_by: 'title', sort_order: 'asc' },
  { label: 'Alphabetical (Z-A)', value: 'alpha_desc', sort_by: 'title', sort_order: 'desc' },
];

const getPromptPreview = (prompt: string | PromptContent): string => {
  let previewText: string;
  if (typeof prompt === 'string') {
    previewText = prompt;
  } else {
    previewText = JSON.stringify(prompt, null, 2);
  }
  return previewText.length > 100 ? `${previewText.substring(0, 100)}...` : previewText;
};

const GridView = ({ prompts, onEdit, onDelete, onFavoriteToggle }: { 
  prompts: PromptTemplate[]; 
  onEdit: (prompt: PromptTemplate) => void;
  onDelete: (prompt: PromptTemplate) => void;
  onFavoriteToggle: (prompt: PromptTemplate) => void;
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {prompts.map((prompt) => (
        <Card key={prompt.id} className="flex flex-col dark:bg-background dark:border-gray-700">
          <CardContent className="pt-6 flex-grow">
            <div className="flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold dark:text-white">{prompt.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{prompt.description}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onFavoriteToggle(prompt)}
                    className="dark:hover:bg-gray-700"
                  >
                    <Star className={prompt.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"} size={20} />
                  </Button>
                  <Link href={`/prompt-templates/${prompt.id}`} passHref>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-blue-500 hover:text-blue-700 dark:hover:bg-gray-700"
                    >
                      <Edit size={20} />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(prompt)}
                    className="text-red-500 hover:text-red-700 dark:hover:bg-gray-700"
                  >
                    <Trash2 size={20} />
                  </Button>
                </div>
              </div>
              {!prompt.is_complex && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                  {getPromptPreview(prompt.prompt)}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {prompt.categories.map((category, index) => (
                  <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {category.name}
                  </Badge>
                ))}
                {prompt.tags.map((tag, index) => (
                  <Badge key={`tag-${index}`} variant="outline" className="dark:border-gray-600 dark:text-gray-300">
                    {tag.name}
                  </Badge>
                ))}
                {prompt.is_complex && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    Form Template
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const TableView = ({ prompts, onEdit, onDelete, onFavoriteToggle }: { 
  prompts: PromptTemplate[]; 
  onEdit: (prompt: PromptTemplate) => void;
  onDelete: (prompt: PromptTemplate) => void;
  onFavoriteToggle: (prompt: PromptTemplate) => void;
}) => {
  return (
    <Table>
      <TableHeader>
        <TableRow className="dark:border-gray-700">
          <TableHead>Title</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Categories & Tags</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prompts.map((prompt) => (
          <TableRow key={prompt.id} className="dark:border-gray-700">
            <TableCell className="font-medium dark:text-white">
              <div className="flex items-center gap-2">
                {prompt.title}
                {prompt.is_complex && <Code className="text-purple-600 dark:text-purple-400" size={16} />}
              </div>
            </TableCell>
            <TableCell className="dark:text-gray-300">{prompt.description || 'No description'}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {prompt.categories.map((category, index) => (
                  <Badge key={index} variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {category.name}
                  </Badge>
                ))}
                {prompt.tags.map((tag, index) => (
                  <Badge key={`tag-${index}`} variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-300">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onFavoriteToggle(prompt)}
                  className="dark:hover:bg-gray-700"
                >
                  <Star className={prompt.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"} size={16} />
                </Button>
                <Link href={`/prompt-templates/${prompt.id}`} passHref>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-blue-500 hover:text-blue-700 dark:hover:bg-gray-700"
                  >
                    <Edit size={16} />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(prompt)}
                  className="text-red-500 hover:text-red-700 dark:hover:bg-gray-700"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function PromptTemplateLibrary({ 
  prompts, 
  onEdit, 
  onDelete,
  onNewSimple,
  onNewComplex,
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  onFavoriteToggle,
  onUpdateFilters
}: PromptTemplateLibraryProps) {
  const { session } = useSession();
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedSort, setSelectedSort] = useState<string>('created_desc')
  const [showFavorited, setShowFavorited] = useState(false)
  const [showMyPrompts, setShowMyPrompts] = useState(false)
  const itemsPerPage = 10

  const totalPages = Math.ceil(prompts.length / itemsPerPage)
  const paginatedPrompts = viewMode === 'table' 
    ? prompts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : prompts

  // Check if any prompts have is_favorite=true and filters.favorited_by exists
  // This indicates the favorites filter is active
  useEffect(() => {
    // If at least one prompt is marked as favorite and the list seems filtered (smaller than expected)
    // then we should set our local showFavorited state to true
    const hasFavorites = prompts.some(p => p.is_favorite);
    const isFavoritesFiltered = hasFavorites && prompts.every(p => p.is_favorite);
    
    if (isFavoritesFiltered) {
      setShowFavorited(true);
    }
  }, [prompts]);

  // Handle sort change
  const handleSortChange = (value: string) => {
    setSelectedSort(value)
    const sortOption = sortOptions.find(opt => opt.value === value)
    if (sortOption) {
      onUpdateFilters({
        sort_by: sortOption.sort_by,
        sort_order: sortOption.sort_order,
      })
    }
  }

  // Handle favorites filter change
  const handleFavoritesChange = (checked: boolean) => {
    setShowFavorited(checked);
    onUpdateFilters({
      favorited_by: checked ? 'current_user' : undefined,
    });
  }

  // Add this effect to update filters when showMyPrompts changes
  useEffect(() => {
    if (showMyPrompts && session?.user?.id) {
      onUpdateFilters({ created_by: session.user.id });
    } else {
      onUpdateFilters({ created_by: undefined });
    }
  }, [showMyPrompts, session?.user?.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-background dark:border-gray-700">
        <h1 className="text-2xl font-bold dark:text-white">Prompt Templates</h1>
        <div className="flex items-center gap-4">
          <div className="flex border rounded-lg dark:border-gray-700">
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
          <div className="flex items-center gap-2 min-w-[300px] justify-end">
            <Button onClick={onNewSimple} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Template
            </Button>
            <Button onClick={onNewComplex} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Form Template
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4 bg-white dark:bg-background dark:border-gray-700 border-b">
        <div className="flex flex-col gap-4">
          <Input
            type="search"
            placeholder="Search prompts..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-sm"
          />
          <PromptTemplateFilters
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={onCategoryChange}
            showFavorites={showFavorited}
            onFavoritesChange={handleFavoritesChange}
            showMyPrompts={showMyPrompts}
            onMyPromptsChange={setShowMyPrompts}
            filters={{}}
            onUpdateFilters={onUpdateFilters}
          />
        </div>
      </div>
      <ScrollArea className="flex-grow bg-white dark:bg-background">
        {viewMode === 'grid' ? <GridView prompts={paginatedPrompts} onEdit={onEdit} onDelete={onDelete} onFavoriteToggle={onFavoriteToggle} /> : <TableView prompts={paginatedPrompts} onEdit={onEdit} onDelete={onDelete} onFavoriteToggle={onFavoriteToggle} />}
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
      </ScrollArea>
    </div>
  )
}
