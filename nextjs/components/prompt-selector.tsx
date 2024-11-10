import { useState, useEffect } from 'react'
import { PromptTemplate } from './promptTemplateService'
import { Category } from './categoryService'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Star } from 'lucide-react'

type PromptSelectorProps = {
  prompts: PromptTemplate[];
  categories: Category[];
  onSelectPrompt: (prompt: PromptTemplate) => void;
  children?: React.ReactNode;
}

export function PromptSelector({ prompts, categories, onSelectPrompt, children }: PromptSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [groupedPrompts, setGroupedPrompts] = useState<{ [key: string]: PromptTemplate[] }>({})

  useEffect(() => {
    const newGroupedPrompts: { [key: string]: PromptTemplate[] } = {
      'All': [],
    }

    // Initialize categories
    categories.forEach(category => {
      newGroupedPrompts[category.name] = []
    })

    // Group prompts by category
    prompts.forEach(prompt => {
      // Add to All category
      newGroupedPrompts['All'].push(prompt)

      // Add to respective categories
      prompt.categories.forEach(category => {
        const categoryName = category.name
        if (!newGroupedPrompts[categoryName]) {
          newGroupedPrompts[categoryName] = []
        }
        newGroupedPrompts[categoryName].push(prompt)
      })
    })

    setGroupedPrompts(newGroupedPrompts)
  }, [prompts, categories])

  const filteredPrompts = Object.entries(groupedPrompts).reduce(
    (acc, [category, categoryPrompts]) => {
      acc[category] = categoryPrompts.filter(prompt =>
        prompt.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
      return acc
    },
    {} as { [key: string]: PromptTemplate[] }
  )

  return (
    <div className="w-full max-w-sm">
      {children}
      <Input
        type="search"
        placeholder="Search prompts..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4"
      />
      <ScrollArea className="h-[300px]">
        {Object.entries(filteredPrompts).map(([category, categoryPrompts]) => (
          categoryPrompts.length > 0 && (
            <div key={category} className="mb-4">
              <h3 className="font-semibold mb-2">{category}</h3>
              <div className="space-y-2">
                {categoryPrompts.map((prompt) => (
                  <Button
                    key={prompt.id}
                    variant="ghost"
                    className="w-full justify-start text-left"
                    onClick={() => onSelectPrompt(prompt)}
                  >
                    {prompt.title}
                  </Button>
                ))}
              </div>
            </div>
          )
        ))}
      </ScrollArea>
    </div>
  )
}