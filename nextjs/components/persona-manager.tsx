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
import AvatarSelector from './avatar-selector'
import { Tag } from '../utils/tag-service'
import { useSession } from '@/app/utils/session/session'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Category, fetchCategories } from '../utils/category-service'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  temperature?: number;
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
    temperature: 0.7,
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

  const handleAvatarChange = (avatar: string) => {
    setCurrentPersona(prev => ({ ...prev, avatar }))
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
    <div className="absolute inset-0 bg-white dark:bg-gray-900 z-50">
      <div className="h-full w-full overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{persona ? 'Edit Persona' : 'Create Persona'}</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-6 w-6" />
            </Button>
          </div>

          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div>
                <Label htmlFor="role">Role</Label>
                <Input id="role" name="role" value={currentPersona.role || ''} onChange={handleInputChange} placeholder="Senior Software Engineer" />
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
                  className="min-h-[200px]"
                />
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
            </TabsContent>

            <TabsContent value="appearance" className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <Label className="text-lg mb-2">Avatar Style</Label>
                  <p className="text-sm text-gray-600 mb-4">Choose a Lorelei style for your persona's avatar</p>
                </div>
                <AvatarSelector
                  value={currentPersona.avatar}
                  onChange={handleAvatarChange}
                  size={128}
                />
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              <div>
                <Label htmlFor="temperature">Temperature (0-1)</Label>
                <Input
                  type="number"
                  id="temperature"
                  name="temperature"
                  value={currentPersona.temperature || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0 && value <= 1) {
                      setCurrentPersona(prev => ({ ...prev, temperature: value }));
                    }
                  }}
                  step="0.1"
                  min="0"
                  max="1"
                  className="w-full"
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
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
