import { useState, useEffect, ReactNode } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PromptTemplate } from '@/utils/prompt-template-service'
import { Category } from '@/utils/category-service'

type PromptSelectorProps = {
  prompts: PromptTemplate[]
  categories: Category[]
  onSelectPrompt: (prompt: PromptTemplate) => void
  children: ReactNode
}

export function PromptSelector({ prompts, categories, onSelectPrompt, children }: PromptSelectorProps) {
  const [groupedPrompts, setGroupedPrompts] = useState<{ [key: string]: PromptTemplate[] }>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const newGroupedPrompts: { [key: string]: PromptTemplate[] } = {
      'All Prompts': [] // Default category for prompts without a category
    }
    
    // Initialize categories
    categories.forEach(category => {
      newGroupedPrompts[category.name] = []
    })

    // Group prompts by category
    prompts.forEach(prompt => {
      if (!prompt.categories || prompt.categories.length === 0) {
        // If prompt has no categories, add to 'All Prompts'
        newGroupedPrompts['All Prompts'].push(prompt)
      } else {
        prompt.categories.forEach(category => {
          if (newGroupedPrompts[category.name]) {
            newGroupedPrompts[category.name].push(prompt)
          }
        })
      }
    })

    setGroupedPrompts(newGroupedPrompts)
  }, [prompts, categories])

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

  const handleCategoryClick = (category: Category) => {
    // ... existing code
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
          {Object.entries(filteredCategories).length > 0 ? (
            Object.entries(filteredCategories).map(([category, categoryPrompts]) => (
              <div key={category} className="p-2">
                <h3 className="font-semibold mb-2">{category}</h3>
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
            ))
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