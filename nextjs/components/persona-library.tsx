import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import PersonaManager from './persona-manager'
import { Persona, deletePersona } from './persona-service'
import { Badge } from "@/components/ui/badge"
import { useSession } from '@/app/utils/session/session';

type PersonaLibraryProps = {
  personas: Persona[];
  onUpdatePersonas: () => Promise<void>;
}

export default function PersonaLibrary({ personas, onUpdatePersonas }: PersonaLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [personaToDelete, setPersonaToDelete] = useState<number | null>(null)
  const { getApiHeaders } = useSession();

  const filteredPersonas = personas.filter(persona =>
    persona.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    persona.goal.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
      // Handle error (e.g., show error message to user)
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <h1 className="text-2xl font-bold">Persona Library</h1>
        <Button onClick={handleCreatePersona} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="mr-2 h-4 w-4" />
          New Persona
        </Button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {filteredPersonas.length > 0 ? (
            filteredPersonas.map((persona) => (
              <Card key={persona.id} className="flex flex-col">
                <CardContent className="flex-grow p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{persona.role}</h3>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEditPersona(persona)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-100">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeletePersona(persona.id)} className="text-red-500 hover:text-red-700 hover:bg-red-100">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm mb-4">{persona.goal}</p>
                </CardContent>
                <CardFooter className="border-t p-4">
                  <div className="flex flex-wrap gap-2">
                    {persona.tags.map(tag => (
                      <Badge key={tag.id} variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </CardFooter>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-500">No personas found</div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
