import { Button } from "@/components/ui/button"
import { X } from 'lucide-react'
import { UploadedFile } from '@/utils/upload-service'

interface FileUploadPillsProps {
  files: UploadedFile[]
  onRemove: (file: UploadedFile) => void
}

export function FileUploadPills({ files, onRemove }: FileUploadPillsProps) {
  if (files.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {files.map((file, index) => (
        <div key={index} className="flex items-center bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-full px-3 py-1">
          <span className="text-sm truncate max-w-[150px]">{file.name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-auto p-0 dark:hover:bg-gray-600"
            onClick={() => onRemove(file)}
          >
            <X className="h-4 w-4 dark:text-gray-200" />
          </Button>
        </div>
      ))}
    </div>
  )
}
