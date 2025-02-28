import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Edit, Trash2, LayoutGrid, List } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import PersonaManager from './persona-manager'
import { Persona, deletePersona } from '../utils/persona-service'
import { Badge } from "@/components/ui/badge"
import { useSession } from '@/app/utils/session/session';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination"
import AvatarDisplay from './ui/avatar-display'
import { useRouter } from 'next/navigation'

type PersonaLibraryProps = {
  personas: Persona[];
  onUpdatePersonas: () => Promise<void>;
}

type ViewMode = 'grid' | 'table';

export default function PersonaLibrary({ personas, onUpdatePersonas }: PersonaLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const router = useRouter()
  const itemsPerPage = 10
  const { getApiHeaders } = useSession();

  const filteredPersonas = personas.filter(persona =>
    persona.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    persona.goal.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredPersonas.length / itemsPerPage)
  const paginatedPersonas = viewMode === 'table' 
    ? filteredPersonas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredPersonas

  const handleCreatePersona = () => {
    router.push('/personas/new')
  }

  const handleEditPersona = (persona: Persona) => {
    router.push(`/personas/${persona.id}`)
  }

  const handleDeletePersona = async (personaId: string) => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      
      await deletePersona(personaId, headers);
      await onUpdatePersonas();
    } catch (error) {
      console.error('Error deleting persona:', error);
    }
  }

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {paginatedPersonas.map((persona) => (
        <Card key={persona.id} className="flex flex-col dark:bg-background dark:border-gray-700">
          <CardContent className="flex-grow p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <AvatarDisplay
                  avatar={persona.avatar}
                  size={40}
                  alt={persona.role}
                  className="border-2 border-gray-200 dark:border-gray-700"
                />
                <h3 className="text-lg font-semibold dark:text-white">{persona.role}</h3>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditPersona(persona)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 dark:hover:text-blue-400"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeletePersona(String(persona.id))}
                  className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{persona.goal}</p>
            <div className="flex flex-wrap gap-2">
              {persona.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const renderTableView = () => (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow className="dark:border-gray-700">
            <TableHead>Role</TableHead>
            <TableHead>Goal</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedPersonas.map((persona) => (
            <TableRow key={persona.id} className="dark:border-gray-700">
              <TableCell className="font-medium dark:text-white">{persona.role}</TableCell>
              <TableCell className="dark:text-gray-300">{persona.goal}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {persona.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
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
                    onClick={() => handleEditPersona(persona)}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 dark:hover:text-blue-400"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeletePersona(String(persona.id))}
                    className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900 dark:hover:text-red-400"
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-background dark:border-gray-700">
        <h1 className="text-2xl font-bold dark:text-white">Persona Library</h1>
        <div className="flex gap-4">
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
          <Button onClick={handleCreatePersona} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            New Persona
          </Button>
        </div>
      </div>
      <div className="p-4 bg-white dark:bg-background">
        <Input
          type="search"
          placeholder="Search personas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
        />
      </div>
      <ScrollArea className="flex-grow bg-white dark:bg-background">
        {viewMode === 'grid' ? renderGridView() : renderTableView()}
      </ScrollArea>
    </div>
  )
}
