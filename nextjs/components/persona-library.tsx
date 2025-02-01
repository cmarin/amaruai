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

type PersonaLibraryProps = {
  personas: Persona[];
  onUpdatePersonas: () => Promise<void>;
}

type ViewMode = 'grid' | 'table';

export default function PersonaLibrary({ personas, onUpdatePersonas }: PersonaLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [personaToDelete, setPersonaToDelete] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [currentPage, setCurrentPage] = useState(1)
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
    setIsCreating(true)
  }

  const handleEditPersona = (persona: Persona) => {
    setSelectedPersona(persona)
  }

  const handleDeletePersona = async (personaId: number) => {
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

  const handleSavePersona = async () => {
    try {
      await onUpdatePersonas()
      setSelectedPersona(null)
      setIsCreating(false)
    } catch (error) {
      console.error('Error saving persona:', error)
    }
  }

  if (selectedPersona || isCreating) {
    return (
      <PersonaManager
        persona={selectedPersona}
        onSave={handleSavePersona}
        onClose={() => {
          setSelectedPersona(null)
          setIsCreating(false)
        }}
      />
    )
  }

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {paginatedPersonas.map((persona) => (
        <Card key={persona.id} className="flex flex-col">
          <CardContent className="flex-grow p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{persona.role}</h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditPersona(persona)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeletePersona(Number(persona.id))}
                  className="text-red-500 hover:text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">{persona.goal}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {persona.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
            <div className="flex justify-end">
              <AvatarDisplay
                avatar={persona.avatar}
                size={48}
                alt={persona.role}
                className="border-2 border-gray-200"
              />
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
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Goal</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedPersonas.map((persona) => (
            <TableRow key={persona.id}>
              <TableCell className="font-medium">{persona.role}</TableCell>
              <TableCell>{persona.goal}</TableCell>
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
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeletePersona(Number(persona.id))}
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <h1 className="text-2xl font-bold">Persona Library</h1>
        <div className="flex gap-4">
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
          <Button onClick={handleCreatePersona} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            New Persona
          </Button>
        </div>
      </div>
      <div className="p-4">
        <Input
          type="search"
          placeholder="Search personas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
        />
      </div>
      <ScrollArea className="flex-grow">
        {viewMode === 'grid' ? renderGridView() : renderTableView()}
      </ScrollArea>
    </div>
  )
}
