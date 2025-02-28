'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Copy, Trash2, Send, BookOpen, Loader2, Bot, Sparkles, SmilePlus, Check, FileText, Paperclip, X, Database, Globe2, Settings
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { PromptSelector } from '@/components/prompt-selector'
import { useData } from '@/components/data-context'
import { addToScratchPad as addToScratchPadService } from '@/utils/scratch-pad-service'
import { ComplexPromptModal } from '@/components/complex-prompt-modal'
import { useSession } from '@/app/utils/session/session'
import { useSupabase } from '@/app/contexts/SupabaseContext'
import ChatMessage from '@/components/chat-message'
import { ComboboxPersonas } from '@/components/combobox-personas'
import { ComboboxChatModels } from '@/components/combobox-chat-models'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Suspense } from 'react'
import { FileUploadPills } from '@/components/file-upload-pills'
import { KnowledgeBaseSelector } from '@/components/knowledge-base-selector'
import { UploadService, type UploadedFile } from '@/utils/upload-service'
import { KnowledgeBase, fetchKnowledgeBases } from '@/utils/knowledge-base-service'
import { fetchAssets } from '@/utils/asset-service'
import { Asset } from '@/types/knowledge-base'
import Uppy from '@uppy/core'
import Dashboard from '@uppy/react/lib/Dashboard'
import { 
  handlePromptSelect as handlePromptSelectUtil,
  handleComplexPromptSubmit as handleComplexPromptSubmitUtil
} from '@/utils/chat-utils'
import '@uppy/core/dist/style.min.css'
import '@uppy/dashboard/dist/style.min.css'

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RemixSettings {
  numVariations: number;
  enhancement: string;
  customInstructions: string;
}

const ENHANCEMENT_OPTIONS = [
  "None",
  "Concise",
  "Creative",
  "Detailed",
  "Formal",
  "Humorous",
  "Persuasive",
  "Punchy",
  "Poetic",
  "Simplified"
]

// Settings Modal Component
const RemixSettingsModal = ({ 
  isOpen, 
  onClose, 
  settings,
  onSave 
}: { 
  isOpen: boolean
  onClose: () => void
  settings: RemixSettings
  onSave: (settings: RemixSettings) => void 
}) => {
  const [editedSettings, setEditedSettings] = useState<RemixSettings>(settings)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Remix Settings</DialogTitle>
          <DialogDescription>
            Customize how your content will be remixed
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label>Number of Variations</label>
            <Input
              type="number"
              min={1}
              max={5}
              value={editedSettings.numVariations}
              onChange={(e) => setEditedSettings(prev => ({
                ...prev,
                numVariations: parseInt(e.target.value) || 3
              }))}
            />
          </div>
          <div className="grid gap-2">
            <label>Enhancement Style</label>
            <Select
              value={editedSettings.enhancement}
              onValueChange={(value) => setEditedSettings(prev => ({
                ...prev,
                enhancement: value
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select enhancement style" />
              </SelectTrigger>
              <SelectContent>
                {ENHANCEMENT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label>Custom Instructions</label>
            <Textarea
              value={editedSettings.customInstructions}
              onChange={(e) => setEditedSettings(prev => ({
                ...prev,
                customInstructions: e.target.value
              }))}
              placeholder="Add any additional instructions..."
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => {
            onSave(editedSettings)
            onClose()
          }}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ContentRemixContent() {
  const { sidebarOpen } = useSidebar()
  const { promptTemplates: prompts, categories, chatModels: allChatModels, personas } = useData()
  const { session, getApiHeaders } = useSession()
  const supabase = useSupabase()

  // Messages state for each window
  const [messages1, setMessages1] = useState<Message[]>([])
  const [messages2, setMessages2] = useState<Message[]>([])
  const [messages3, setMessages3] = useState<Message[]>([])
  const [messages4, setMessages4] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [selectedModels, setSelectedModels] = useState<{ [key: string]: string }>({})
  const [selectedPersonas, setSelectedPersonas] = useState<{ [key: string]: string }>({})
  const [hasUserChangedModel, setHasUserChangedModel] = useState(false)
  const [hasUserChangedPersona, setHasUserChangedPersona] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [remixSettings, setRemixSettings] = useState<RemixSettings>({
    numVariations: 3,
    enhancement: "None",
    customInstructions: ""
  })
  const [selectedComplexPrompt, setSelectedComplexPrompt] = useState<any | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [showKnowledgeBaseModal, setShowKnowledgeBaseModal] = useState(false)
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(true)
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false)
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const uppyRef = useRef<Uppy | null>(null)

  // Initialize models
  useEffect(() => {
    if (allChatModels?.length > 0) {
      const defaultModel = allChatModels.find(model => model.default)
      if (!defaultModel) return

      const otherModels = allChatModels
        .filter(model => !model.default && model.id !== defaultModel.id)
        .slice(0, 3)

      setSelectedModels(prev => ({
        ...prev,
        chat1: defaultModel.id,
        chat2: otherModels[0]?.id || defaultModel.id,
        chat3: otherModels[1]?.id || defaultModel.id,
        chat4: otherModels[2]?.id || defaultModel.id
      }))
    }
  }, [allChatModels])

  useEffect(() => {
    if (!uppyRef.current) {
      const uppyInstance = UploadService.createUppy(
        'remix-uploader',
        {
          maxFiles: 1,
          storageFolder: 'remixes',
          storageBucket: 'amaruai-dev'
        },
        (file) => {
          setUploadedFiles(prev => [...prev, {
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
            uploadURL: file.uploadURL
          }]);
        },
        () => {
          setShowUploadModal(false)
        },
        supabase
      )
      uppyRef.current = uppyInstance
    }

    return () => {
      if (uppyRef.current) {
        uppyRef.current.cancelAll()
      }
    }
  }, [supabase])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = await getApiHeaders()
        if (!headers) return

        setIsLoadingKnowledgeBases(true)
        const fetchedKnowledgeBases = await fetchKnowledgeBases(headers)
        setKnowledgeBases(fetchedKnowledgeBases)
      } catch (error) {
        console.error('Error fetching knowledge bases:', error)
      } finally {
        setIsLoadingKnowledgeBases(false)
      }
    }
    fetchData()
  }, [getApiHeaders])

  const buildPrompt = (originalContent: string) => {
    let prompt = `Generate ${remixSettings.numVariations} variations of the following text.`
    
    if (remixSettings.enhancement !== "None") {
      prompt += ` Make them ${remixSettings.enhancement.toLowerCase()}.`
    }

    if (remixSettings.customInstructions) {
      prompt += ` ${remixSettings.customInstructions}`
    }

    prompt += `:\n\n${originalContent}`
    return prompt
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    setIsLoading(true)
    setError(null)

    const prompt = buildPrompt(input.trim())
    const newMessage: Message = { role: 'user', content: prompt }

    setMessages1(prev => [...prev, newMessage])
    setMessages2(prev => [...prev, newMessage])
    setMessages3(prev => [...prev, newMessage])
    setMessages4(prev => [...prev, newMessage])
    setInput('')

    try {
      const apiCalls = [
        makeApiCall(messages1, setMessages1, 'chat1'),
        makeApiCall(messages2, setMessages2, 'chat2'),
        makeApiCall(messages3, setMessages3, 'chat3'),
        makeApiCall(messages4, setMessages4, 'chat4'),
      ]

      await Promise.all(apiCalls)
    } catch (err) {
      console.error('Error in handleSubmit:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  const makeApiCall = async (
    prevMessages: Message[],
    setMessagesFunction: React.Dispatch<React.SetStateAction<Message[]>>,
    chatId: string
  ) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiHeaders(),
        },
        body: JSON.stringify({
          messages: [...prevMessages, { role: 'user', content: input.trim() }],
          user_id: session?.user?.id,
          model_id: selectedModels[chatId],
          conversation_id: crypto.randomUUID(),
          knowledge_base_ids: selectedKnowledgeBases.map(kb => kb.id),
          asset_ids: selectedAssets.map(asset => asset.id),
          web: isWebSearchEnabled,
          files: uploadedFiles.map(f => ({ name: f.name, url: f.uploadURL }))
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonData = line.slice(5).trim()
            if (jsonData === '[DONE]') continue

            try {
              const parsed = JSON.parse(jsonData)
              if (parsed.choices?.[0]?.delta?.content) {
                assistantMessage += parsed.choices[0].delta.content
                setMessagesFunction(prev => {
                  const updated = [...prev]
                  if (updated.length === 0 || updated[updated.length - 1].role === 'user') {
                    return [...prev, { role: 'assistant', content: assistantMessage }]
                  }
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: assistantMessage,
                  }
                  return updated
                })
              }
            } catch (error) {
              console.warn('Error parsing chunk:', error)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in API call:', error)
      throw error
    }
  }

  const handleModelChange = (chatWindowId: string, modelId: string) => {
    setSelectedModels(prev => ({ ...prev, [chatWindowId]: modelId }))
    setHasUserChangedModel(true)
  }

  const handlePersonaChange = (chatWindowId: string, personaId: string) => {
    setSelectedPersonas(prev => ({ ...prev, [chatWindowId]: personaId }))
    setHasUserChangedPersona(true)
  }

  const handlePromptSelect = (prompt: any) => {
    handlePromptSelectUtil(prompt, setSelectedComplexPrompt, setInput);
  }

  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    handleComplexPromptSubmitUtil(generatedPrompt, setInput, setSelectedComplexPrompt);
  }

  const handleCloseUploadModal = () => {
    setShowUploadModal(false)
    if (uppyRef.current) {
      uppyRef.current.cancelAll()
    }
  }

  const handleRemoveFile = (file: UploadedFile) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== file.name))
  }

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedStates(prev => ({ ...prev, [content]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [content]: false }))
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const addToScratchPad = async (content: string) => {
    try {
      await addToScratchPadService(content)
    } catch (err) {
      console.error('Failed to add to scratch pad:', err)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="w-64 h-full border-r border-gray-200">
        <AppSidebar />
      </div>

      <div className="flex-1 flex flex-col h-full relative">
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
            {[
              { messages: messages1, chatId: 'chat1' },
              { messages: messages2, chatId: 'chat2' },
              { messages: messages3, chatId: 'chat3' },
              { messages: messages4, chatId: 'chat4' },
            ].map((chat, index) => (
              <div key={index} className="h-full border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-2">
                      <div className="w-[180px]">
                        <ComboboxPersonas
                          personas={personas || []}
                          value={selectedPersonas[chat.chatId]}
                          onSelect={(persona) => handlePersonaChange(chat.chatId, persona.id.toString())}
                        />
                      </div>
                      <div className="w-[180px]">
                        <ComboboxChatModels
                          models={allChatModels || []}
                          value={selectedModels[chat.chatId]}
                          onSelect={(model) => handleModelChange(chat.chatId, model.id)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-8 h-8" 
                            onClick={() => copyToClipboard(chat.messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                          >
                            {copiedStates[chat.messages.map(m => `${m.role}: ${m.content}`).join('\n')] ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {copiedStates[chat.messages.map(m => `${m.role}: ${m.content}`).join('\n')] 
                            ? "Copied!" 
                            : "Copy chat content"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-8 h-8" 
                            onClick={() => addToScratchPad(chat.messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add to Scratch Pad</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <ScrollArea className="h-[calc(100%-60px)] p-4">
                  {chat.messages.map((message, msgIndex) => {
                    const selectedPersona = personas?.find(p => p.id.toString() === selectedPersonas[chat.chatId])
                    return (
                      <ChatMessage
                        key={msgIndex}
                        role={message.role}
                        content={message.content}
                        avatar={selectedPersona?.avatar || null}
                      />
                    )
                  })}
                </ScrollArea>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t p-4 flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <PromptSelector prompts={prompts} categories={categories} onSelectPrompt={handlePromptSelect}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </PromptSelector>
              </TooltipTrigger>
              <TooltipContent>
                <p>Select Prompt</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowUploadModal(true)}>
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Attachment</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-8 w-8 ${selectedKnowledgeBases.length > 0 || selectedAssets.length > 0 ? "text-green-500" : ""}`}
                  onClick={() => setShowKnowledgeBaseModal(true)}
                >
                  <Database className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Knowledge Base</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                    className={`h-8 w-8 ${isWebSearchEnabled ? "text-green-500" : ""}`}
                  >
                    <Globe2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enable Web Search</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setShowSettingsModal(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit Remix Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="Create content variations..."
            className="flex-1"
          />

          <Button onClick={e => handleSubmit(e)} disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        <RemixSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          settings={remixSettings}
          onSave={setRemixSettings}
        />

        {selectedComplexPrompt && (
          <ComplexPromptModal
            prompt={selectedComplexPrompt}
            isOpen={!!selectedComplexPrompt}
            onClose={() => setSelectedComplexPrompt(null)}
            onSubmit={handleComplexPromptSubmit}
          />
        )}

        {showUploadModal && uppyRef.current && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Upload Files</h2>
                <Button variant="ghost" size="icon" onClick={handleCloseUploadModal}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Dashboard uppy={uppyRef.current} plugins={[]} />
            </div>
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="absolute bottom-[72px] left-0 right-0 p-2 bg-background border-t">
            <FileUploadPills files={uploadedFiles} onRemove={handleRemoveFile} />
          </div>
        )}

        <KnowledgeBaseSelector
          knowledgeBases={knowledgeBases}
          isLoadingKnowledgeBases={isLoadingKnowledgeBases}
          selectedKnowledgeBases={selectedKnowledgeBases}
          selectedAssets={selectedAssets}
          onSelectKnowledgeBase={(kb: KnowledgeBase) => {
            setSelectedKnowledgeBases([...selectedKnowledgeBases, kb]);
          }}
          onDeselectKnowledgeBase={(kb: KnowledgeBase) => {
            setSelectedKnowledgeBases(selectedKnowledgeBases.filter(k => k.id !== kb.id));
          }}
          onSelectAsset={(asset: Asset) => {
            setSelectedAssets([...selectedAssets, asset]);
          }}
          onDeselectAsset={(asset: Asset) => {
            setSelectedAssets(selectedAssets.filter(a => a.id !== asset.id));
          }}
          open={showKnowledgeBaseModal}
          onOpenChange={setShowKnowledgeBaseModal}
        />
      </div>
    </div>
  )
}

export default function ContentRemix() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContentRemixContent />
    </Suspense>
  )
} 