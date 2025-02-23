'use client';

import { useState } from 'react'
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
        <Card key={prompt.id} className="flex flex-col">
          <CardContent className="pt-6 flex-grow">
            <div className="flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-grow">
                  <h3 className="text-lg font-semibold">{prompt.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{prompt.description}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onFavoriteToggle(prompt)}
                  >
                    <Star className={prompt.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"} size={20} />
                  </Button>
                  <Link href={`/prompt-templates/${prompt.id}`} passHref>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <Edit size={20} />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(prompt)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={20} />
                  </Button>
                </div>
              </div>
              {!prompt.is_complex && (
                <p className="text-sm text-gray-600 mt-2">
                  {getPromptPreview(prompt.prompt)}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {prompt.categories.map((category, index) => (
                  <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800">
                    {category.name}
                  </Badge>
                ))}
                {prompt.tags.map((tag, index) => (
                  <Badge key={`tag-${index}`} variant="outline">
                    {tag.name}
                  </Badge>
                ))}
                {prompt.is_complex && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
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
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Categories & Tags</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prompts.map((prompt) => (
          <TableRow key={prompt.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium">{prompt.title}</span>
                {prompt.is_complex && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    Form Template
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {prompt.categories.map((category, index) => (
                  <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800">
                    {category.name}
                  </Badge>
                ))}
                {prompt.tags.map((tag, index) => (
                  <Badge key={`tag-${index}`} variant="outline">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onFavoriteToggle(prompt)}
                  className={prompt.is_favorite ? "text-yellow-500" : ""}
                >
                  <Star className="h-4 w-4" />
                </Button>
                <Link href={`/prompt-templates/${prompt.id}`} passHref>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <Edit size={20} />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(prompt)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={20} />
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
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedSort, setSelectedSort] = useState<string>('created_desc')
  const [showFavorited, setShowFavorited] = useState(false)
  const itemsPerPage = 10

  const totalPages = Math.ceil(prompts.length / itemsPerPage)
  const paginatedPrompts = viewMode === 'table' 
    ? prompts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : prompts

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
    setShowFavorited(checked)
    onUpdateFilters({
      favorited_by: checked ? 'current_user' : undefined,
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <h1 className="text-2xl font-bold">Prompt Templates</h1>
        <div className="flex items-center gap-4">
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
      <div className="p-4 bg-white border-b">
        <div className="flex gap-4 items-center">
          <Input
            type="search"
            placeholder="Search prompts..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={selectedCategory || 'all'}
            onValueChange={(value) => onCategoryChange(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFavorited}
                onChange={(e) => handleFavoritesChange(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              <span>Show Favorites Only</span>
            </label>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-grow">
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
