'use client';

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { KnowledgeBaseManager } from '@/components/knowledge-base-manager'
import { KnowledgeBase, deleteKnowledgeBase } from '@/utils/knowledge-base-service'
import { useSession } from '@/app/utils/session/session';

type KnowledgeBaseLibraryProps = {
  knowledgeBases: KnowledgeBase[];
  onUpdateKnowledgeBases: () => Promise<void>;
}

export function KnowledgeBaseLibrary({ knowledgeBases, onUpdateKnowledgeBases }: KnowledgeBaseLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const { getApiHeaders } = useSession();

  const filteredKnowledgeBases = knowledgeBases.filter(kb =>
    kb.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    kb.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateKnowledgeBase = () => {
    setIsCreating(true)
  }

  const handleEditKnowledgeBase = (knowledgeBase: KnowledgeBase) => {
    setSelectedKnowledgeBase(knowledgeBase)
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
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <h1 className="text-2xl font-bold">Knowledge Base Library</h1>
        <Button onClick={handleCreateKnowledgeBase} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="mr-2 h-4 w-4" />
          New Knowledge Base
        </Button>
      </div>
      <div className="p-4">
        <Input
          type="search"
          placeholder="Search knowledge bases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
        />
      </div>
      <ScrollArea className="flex-grow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {filteredKnowledgeBases.length > 0 ? (
            filteredKnowledgeBases.map((kb) => (
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
      </ScrollArea>
    </div>
  )
} 