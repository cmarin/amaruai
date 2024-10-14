import { useState } from 'react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"
import { Tag } from './tagService'

interface TagSelectorProps {
  tags: Tag[]
  setTags: (tags: Tag[]) => void
  placeholder?: string
}

export default function TagSelector({ tags, setTags, placeholder = "Add a tag" }: TagSelectorProps) {
  const [inputValue, setInputValue] = useState('')

  const addTag = () => {
    if (inputValue && !tags.some(tag => tag.name.toLowerCase() === inputValue.toLowerCase())) {
      setTags([...tags, { id: 0, name: inputValue }])
      setInputValue('')
    }
  }

  const removeTag = (tagToRemove: Tag) => {
    setTags(tags.filter(tag => tag.name !== tagToRemove.name))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <Badge key={tag.id || tag.name} variant="secondary" className="text-sm">
            {tag.name}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-2"
              onClick={() => removeTag(tag)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            }
          }}
        />
        <Button onClick={addTag} className="bg-blue-600 hover:bg-blue-700 text-white">Add Tag</Button>
      </div>
    </div>
  )
}