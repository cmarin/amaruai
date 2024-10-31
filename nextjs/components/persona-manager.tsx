import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from 'lucide-react'
import { Persona, createPersona, updatePersona } from './personaService'
import TagSelector from './tag-selector'
import { Tag } from './tagService'
import { useSession } from '@/app/utils/session/session'

type PersonaManagerProps = {
  persona: Persona | null
  onSave: (persona: Persona) => void
  onClose: () => void
}

export default function PersonaManager({ persona, onSave, onClose }: PersonaManagerProps) {
  const [currentPersona, setCurrentPersona] = useState<Omit<Persona, 'id'>>({
    role: '',
    goal: '',
    backstory: '',
    allow_delegation: false,
    verbose: false,
    memory: false,
    avatar: null,
    tools: [],
    categories: [],
    tags: [],
    prompt_templates: []
  })
  const [newTool, setNewTool] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const { getApiHeaders } = useSession();

  useEffect(() => {
    if (persona) {
      // When editing, include all fields from the existing persona
      const { id, ...personaWithoutId } = persona;
      setCurrentPersona(personaWithoutId);
    }
  }, [persona])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setCurrentPersona(prev => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: 'allow_delegation' | 'verbose' | 'memory') => {
    setCurrentPersona(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const handleToolsChange = () => {
    if (newTool && !currentPersona.tools.some(t => t.name === newTool)) {
      setCurrentPersona(prev => ({
        ...prev,
        tools: [...prev.tools, { name: newTool, id: Date.now() }]
      }))
      setNewTool('')
    }
  }

  const handleRemoveTool = (toolToRemove: string) => {
    setCurrentPersona(prev => ({
      ...prev,
      tools: prev.tools.filter(tool => tool.name !== toolToRemove)
    }))
  }

  const handleCategoryChange = () => {
    if (newCategory && !currentPersona.categories.some(c => c.name === newCategory)) {
      setCurrentPersona(prev => ({
        ...prev,
        categories: [...prev.categories, { name: newCategory, id: Date.now() }]
      }))
      setNewCategory('')
    }
  }

  const handleRemoveCategory = (categoryToRemove: string) => {
    setCurrentPersona(prev => ({
      ...prev,
      categories: prev.categories.filter(category => category.name !== categoryToRemove)
    }))
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setCurrentPersona(prev => ({ ...prev, avatar: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      let savedPersona: Persona;
      if (persona) {
        // When updating, include the ID from the original persona
        savedPersona = await updatePersona(persona.id, currentPersona, headers);
      } else {
        // When creating, don't include an ID
        savedPersona = await createPersona(currentPersona, headers);
      }
      onSave(savedPersona);
    } catch (error) {
      console.error('Error saving persona:', error);
      // Handle error (e.g., show error message to user)
    }
  }

  return (
    <div className="absolute inset-0 bg-white z-50">
      <div className="h-full w-full overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{persona ? 'Edit Persona' : 'Create Persona'}</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="role">Role</Label>
              <Input id="role" name="role" value={currentPersona.role || ''} onChange={handleInputChange} placeholder="Senior Software Engineer" />
            </div>

            <div>
              <Label htmlFor="avatar">Agent Image</Label>
              <Input id="avatar" name="avatar" type="file" onChange={handleAvatarUpload} accept="image/*" />
            </div>

            <div>
              <Label htmlFor="goal">Goal</Label>
              <Input id="goal" name="goal" value={currentPersona.goal || ''} onChange={handleInputChange} placeholder="Develop efficient and scalable software solutions" />
            </div>

            <div>
              <Label htmlFor="backstory">Backstory</Label>
              <Textarea 
                id="backstory" 
                name="backstory" 
                value={currentPersona.backstory || ''} 
                onChange={handleInputChange}
                placeholder="You are a seasoned software engineer with 10 years of experience in various programming languages and frameworks. You specialize in backend development and system architecture."
              />
            </div>

            <div>
              <Label htmlFor="tools">Tools</Label>
              <div className="flex space-x-2">
                <Input
                  id="tools"
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                  placeholder="Add a tool"
                />
                <Button onClick={handleToolsChange} className="bg-blue-600 hover:bg-blue-700 text-white">Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {currentPersona.tools.map((tool, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center">
                    {tool.name}
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveTool(tool.name)} className="ml-1 h-auto p-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="categories">Categories</Label>
              <div className="flex space-x-2">
                <Input
                  id="categories"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Add a category"
                />
                <Button onClick={handleCategoryChange} className="bg-blue-600 hover:bg-blue-700 text-white">Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {currentPersona.categories.map((category, index) => (
                  <Badge key={index} variant="outline" className="flex items-center">
                    {category.name}
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveCategory(category.name)} className="ml-1 h-auto p-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="tags">Tags</Label>
              <TagSelector
                tags={currentPersona.tags}
                setTags={(tags) => setCurrentPersona(prev => ({ ...prev, tags }))}
                placeholder="Add a tag"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="allow_delegation" 
                checked={currentPersona.allow_delegation}
                onCheckedChange={() => handleSwitchChange('allow_delegation')} 
              />
              <Label htmlFor="allow_delegation">Allow Delegation</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="verbose" 
                checked={currentPersona.verbose}
                onCheckedChange={() => handleSwitchChange('verbose')} 
              />
              <Label htmlFor="verbose">Verbose</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="memory" 
                checked={currentPersona.memory}
                onCheckedChange={() => handleSwitchChange('memory')} 
              />
              <Label htmlFor="memory">Memory</Label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
