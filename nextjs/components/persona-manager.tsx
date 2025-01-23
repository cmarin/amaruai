import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from 'lucide-react'
import { Persona, createPersona, updatePersona } from '../utils/persona-service'
import TagSelector from './tag-selector'
import { Tag } from '../utils/tag-service'
import { useSession } from '@/app/utils/session/session'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Category, fetchCategories } from '../utils/category-service'

type PersonaManagerProps = {
  persona: Persona | null
  onSave: (persona: Persona) => void
  onClose: () => void
}

interface Tool {
  id: number;
  name: string;
}

interface PersonaState {
  role: string;
  goal: string;
  backstory: string;
  description: string;
  allow_delegation: boolean;
  verbose: boolean;
  memory: boolean;
  avatar: string | null;
  tools: Tool[];
  category_ids: string[];
  tags: string[];
  prompt_templates: any[];
}

export default function PersonaManager({ persona, onSave, onClose }: PersonaManagerProps) {
  const [currentPersona, setCurrentPersona] = useState<PersonaState>({
    role: '',
    goal: '',
    backstory: '',
    description: '',
    allow_delegation: false,
    verbose: false,
    memory: false,
    avatar: null,
    tools: [],
    category_ids: [],
    tags: [],
    prompt_templates: [],
  })
  const [newTool, setNewTool] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const { getApiHeaders } = useSession();

  useEffect(() => {
    if (persona) {
      const { id, categories, tags, created_at, updated_at, ...rest } = persona;
      setCurrentPersona({
        ...rest,
        category_ids: categories.map(c => c.id.toString()),
        tags: tags.map(t => t.name),
      });
    }
  }, [persona])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const headers = getApiHeaders();
        if (!headers) {
          console.error('No valid headers available');
          return;
        }
        const fetchedCategories = await fetchCategories(headers);
        setCategories(fetchedCategories);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, [getApiHeaders]);

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

  const handleCategoryChange = (categoryId: string) => {
    setCurrentPersona(prev => ({
      ...prev,
      category_ids: [categoryId]
    }))
  }

  const handleTagsChange = (tags: Tag[]) => {
    setCurrentPersona(prev => ({
      ...prev,
      tags: tags.map(t => t.name)
    }))
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setCurrentPersona(prev => ({ ...prev, avatar: result }))
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
        savedPersona = await updatePersona(persona.id.toString(), currentPersona, headers);
      } else {
        savedPersona = await createPersona(currentPersona, headers);
      }
      onSave(savedPersona);
    } catch (error) {
      console.error('Error saving persona:', error);
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
              <Label htmlFor="category">Category</Label>
              <Select
                value={currentPersona.category_ids[0] || ''}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tags</Label>
              <TagSelector
                tags={currentPersona.tags.map(name => ({ id: `temp_${name}`, name }))}
                setTags={(tags: Tag[]) => handleTagsChange(tags)}
                placeholder="Add tags"
              />
            </div>

            <div className="space-y-4">
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

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
