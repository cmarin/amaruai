import { useState, useEffect, ReactNode } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PromptTemplate, fetchPromptTemplates } from '@/utils/prompt-template-service'
import { Category } from '@/utils/category-service'
import { Star, Plus } from 'lucide-react'
import { useSession } from '@/app/utils/session/session'

type PromptSelectorProps = {
  prompts: PromptTemplate[]
  categories: Category[]
  onSelectPrompt: (prompt: PromptTemplate) => void
  children: ReactNode
  onLoad?: (newPrompts: PromptTemplate[]) => void
}

export function PromptSelector({ prompts, categories, onSelectPrompt, children, onLoad }: PromptSelectorProps) {
  const [groupedPrompts, setGroupedPrompts] = useState<{ [key: string]: PromptTemplate[] }>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [offset, setOffset] = useState(30) // Initial load is ~30 prompts
  const { getApiHeaders } = useSession()

  useEffect(() => {
    // Log for debugging
    console.log('Prompts received in selector:', prompts.length, 'favorites:', prompts.filter(p => p.is_favorite).length);
    
    // Initialize with special categories in a specific order
    const newGroupedPrompts: { [key: string]: PromptTemplate[] } = {}
    
    // Identify favorites
    const favoritePrompts = prompts.filter(prompt => prompt.is_favorite)
    console.log('Favorites identified:', favoritePrompts.length);
    
    // Add Favorites category only if there are favorited prompts
    if (favoritePrompts.length > 0) {
      newGroupedPrompts['Favorites'] = favoritePrompts
    }
    
    // Get all category names and sort alphabetically
    const categoryNames = categories
      .map(category => category.name)
      .sort((a, b) => a.localeCompare(b))
    
    // Initialize categories in alphabetical order
    categoryNames.forEach(name => {
      newGroupedPrompts[name] = []
    })
    
    // Create Uncategorized category (rename from 'All Prompts')
    newGroupedPrompts['Uncategorized'] = []
    
    // Group prompts by category
    prompts.forEach(prompt => {
      if (!prompt.categories || prompt.categories.length === 0) {
        // If prompt has no categories, add to 'Uncategorized'
        newGroupedPrompts['Uncategorized'].push(prompt)
      } else {
        prompt.categories.forEach(category => {
          if (newGroupedPrompts[category.name]) {
            newGroupedPrompts[category.name].push(prompt)
          }
        })
      }
    })
    
    // Remove empty categories
    Object.keys(newGroupedPrompts).forEach(key => {
      if (newGroupedPrompts[key].length === 0 && key !== 'Uncategorized') {
        delete newGroupedPrompts[key]
      }
    })
    
    setGroupedPrompts(newGroupedPrompts)
  }, [prompts, categories])

  // Filter categories based on search term
  const filteredCategories = Object.entries(groupedPrompts).reduce((acc, [category, categoryPrompts]) => {
    const filteredPrompts = categoryPrompts.filter(prompt =>
      prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prompt.prompt && typeof prompt.prompt === 'string' && prompt.prompt.toLowerCase().includes(searchTerm.toLowerCase())) ||
      prompt.categories.some(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      prompt.tags.some(tag => tag.name && tag.name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    if (filteredPrompts.length > 0) {
      acc[category] = filteredPrompts
    }
    return acc
  }, {} as { [key: string]: PromptTemplate[] })

  // Ensure categories are displayed in the correct order
  const orderedCategories = Object.entries(filteredCategories).sort((a, b) => {
    // Favorites always first
    if (a[0] === 'Favorites') return -1;
    if (b[0] === 'Favorites') return 1;
    // Uncategorized always last
    if (a[0] === 'Uncategorized') return 1;
    if (b[0] === 'Uncategorized') return -1;
    // Everything else alphabetically
    return a[0].localeCompare(b[0]);
  });

  const handleLoadMore = async () => {
    if (isLoadingMore) return; // Prevent duplicate calls
    
    setIsLoadingMore(true)
    try {
      const headers = getApiHeaders()
      if (!headers) {
        console.error('No valid headers available')
        setIsLoadingMore(false)
        return
      }

      console.log(`Loading more prompts starting from offset ${offset}`);
      
      // Fetch next batch of prompts
      const additionalPrompts = await fetchPromptTemplates(headers, {
        skip: offset,
        limit: 20,
        sort_by: 'created_at',
        sort_order: 'desc'
      })

      if (additionalPrompts.length > 0) {
        console.log(`Loaded ${additionalPrompts.length} additional prompts`);
        
        // Increment the offset for next load
        setOffset(prev => prev + additionalPrompts.length)
        
        // Notify parent component about new prompts
        if (onLoad) {
          onLoad(additionalPrompts)
        }
      } else {
        console.log('No additional prompts found');
      }
    } catch (error) {
      console.error('Error loading more prompts:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <div className="p-2">
          <Input
            type="text"
            placeholder="Search prompts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2"
          />
        </div>
        <ScrollArea className="h-[300px]">
          {orderedCategories.length > 0 ? (
            <>
              {orderedCategories.map(([category, categoryPrompts]) => (
                <div key={category} className="p-2">
                  <h3 className="font-semibold mb-2 flex items-center">
                    {category === 'Favorites' && <Star className="h-4 w-4 mr-1 text-yellow-400" />}
                    {category}
                  </h3>
                  {categoryPrompts.map(prompt => (
                    <Button
                      key={prompt.id}
                      variant="ghost"
                      className="w-full justify-start text-left"
                      onClick={() => {
                        onSelectPrompt(prompt)
                        setIsOpen(false)
                      }}
                    >
                      {prompt.title}
                    </Button>
                  ))}
                </div>
              ))}
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  className="w-full justify-center text-blue-600 hover:text-blue-800"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Loading...' : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Load More
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              No prompts found
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}