'use client';

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { X } from 'lucide-react'
import { KnowledgeBase, createKnowledgeBase, updateKnowledgeBase, KnowledgeBaseCreate } from '@/utils/knowledge-base-service'
import { useSession } from '@/app/utils/session/session'

type KnowledgeBaseManagerProps = {
  knowledgeBase: KnowledgeBase | null
  onSave: () => void
  onClose: () => void
}

export function KnowledgeBaseManager({ knowledgeBase, onSave, onClose }: KnowledgeBaseManagerProps) {
  const [currentKnowledgeBase, setCurrentKnowledgeBase] = useState({
    title: '',
    description: '',
    assets: [] as KnowledgeBase['assets']
  })
  const { getApiHeaders } = useSession();

  useEffect(() => {
    if (knowledgeBase) {
      setCurrentKnowledgeBase({
        title: knowledgeBase.title,
        description: knowledgeBase.description,
        assets: knowledgeBase.assets
      })
    }
  }, [knowledgeBase])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setCurrentKnowledgeBase(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      const payload: KnowledgeBaseCreate = {
        title: currentKnowledgeBase.title,
        description: currentKnowledgeBase.description,
        asset_ids: currentKnowledgeBase.assets.map(asset => asset.id)
      };

      if (knowledgeBase) {
        await updateKnowledgeBase(knowledgeBase.id, payload, headers);
      } else {
        await createKnowledgeBase(payload, headers);
      }
      onSave();
    } catch (error) {
      console.error('Error saving knowledge base:', error);
    }
  }

  return (
    <div className="absolute inset-0 bg-white z-50">
      <div className="h-full w-full overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">
              {knowledgeBase ? 'Edit Knowledge Base' : 'Create Knowledge Base'}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={currentKnowledgeBase.title}
                onChange={handleInputChange}
                placeholder="Enter knowledge base title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={currentKnowledgeBase.description}
                onChange={handleInputChange}
                placeholder="Enter knowledge base description"
                className="min-h-[100px]"
              />
            </div>

            <div>
              <Label>Linked Assets</Label>
              <div className="mt-2 space-y-2">
                {currentKnowledgeBase.assets.map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between p-2 border rounded">
                    <span>{asset.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentKnowledgeBase(prev => ({
                          ...prev,
                          assets: prev.assets.filter(a => a.id !== asset.id)
                        }))
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 