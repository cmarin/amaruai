import { Button } from "@/components/ui/button"
import { X, Database, File } from 'lucide-react'
import { KnowledgeBase } from '@/utils/knowledge-base-service'
import { Asset } from '@/types/knowledge-base'

interface KnowledgeBaseAssetPillsProps {
  knowledgeBases: KnowledgeBase[]
  assets: Asset[]
  onRemoveKnowledgeBase: (kb: KnowledgeBase) => void
  onRemoveAsset: (asset: Asset) => void
}

export function KnowledgeBaseAssetPills({ 
  knowledgeBases = [], 
  assets = [], 
  onRemoveKnowledgeBase, 
  onRemoveAsset 
}: KnowledgeBaseAssetPillsProps) {
  // Add some debugging
  console.log('KnowledgeBaseAssetPills - knowledgeBases:', knowledgeBases);
  console.log('KnowledgeBaseAssetPills - assets:', assets);
  
  if (!knowledgeBases?.length && !assets?.length) return null

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {knowledgeBases?.map((kb) => (
        <div key={kb.id} className="flex items-center bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-full px-3 py-1">
          <Database className="h-3 w-3 mr-1.5 text-blue-500" />
          <span className="text-sm truncate max-w-[150px]">{kb.title}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-auto p-0 dark:hover:bg-gray-600"
            onClick={() => onRemoveKnowledgeBase(kb)}
          >
            <X className="h-4 w-4 dark:text-gray-200" />
          </Button>
        </div>
      ))}
      {assets?.map((asset) => (
        <div key={asset.id} className="flex items-center bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-full px-3 py-1">
          <File className="h-3 w-3 mr-1.5 text-green-500" />
          <span className="text-sm truncate max-w-[150px]">{asset.title}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-auto p-0 dark:hover:bg-gray-600"
            onClick={() => onRemoveAsset(asset)}
          >
            <X className="h-4 w-4 dark:text-gray-200" />
          </Button>
        </div>
      ))}
    </div>
  )
} 