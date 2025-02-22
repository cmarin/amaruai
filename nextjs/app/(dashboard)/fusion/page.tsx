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
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { PromptSelector } from '@/components/prompt-selector'
import { useData } from '@/components/data-context'
import { addToScratchPad as addToScratchPadService } from '@/utils/scratch-pad-service'
import { ComplexPromptModal } from '@/components/complex-prompt-modal'
import { useSession } from '@/app/utils/session/session'
import { useSupabase } from '@/app/contexts/SupabaseContext'
import Uppy from '@uppy/core'
import Dashboard from '@uppy/react/lib/Dashboard'
import { UploadService, type UploadedFile } from '@/utils/upload-service'
import { FileUploadPills } from '@/components/file-upload-pills'
import { KnowledgeBaseSelector } from '@/components/knowledge-base-selector'
import { KnowledgeBase, fetchKnowledgeBases } from '@/utils/knowledge-base-service'
import { fetchAssets } from '@/utils/asset-service'
import { Asset } from '@/types/knowledge-base'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
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

// Import required Uppy CSS
import '@uppy/core/dist/style.min.css'
import '@uppy/dashboard/dist/style.min.css'

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function FusionContent() {
  // ... (keep most of the same state and hooks from chat/page.tsx)
  const { sidebarOpen } = useSidebar()
  const { promptTemplates: prompts, categories, chatModels: allChatModels, personas } = useData()
  const { session, getApiHeaders } = useSession()
  const supabase = useSupabase()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Messages state for each window
  const [messages1, setMessages1] = useState<Message[]>([])
  const [messages2, setMessages2] = useState<Message[]>([])
  const [messages3, setMessages3] = useState<Message[]>([])
  const [synthesizedMessages, setSynthesizedMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [selectedComplexPrompt, setSelectedComplexPrompt] = useState<any | null>(null)
  const [selectedModels, setSelectedModels] = useState<{ [key: string]: string }>({})
  const [selectedPersonas, setSelectedPersonas] = useState<{ [key: string]: string }>({})
  const [hasUserChangedModel, setHasUserChangedModel] = useState(false)
  const [hasUserChangedPersona, setHasUserChangedPersona] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  // Add new state for synthesis loading and prompt
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [synthesisPrompt, setSynthesisPrompt] = useState<string>(
    `Given this prompt: "{prompt}" and these results from different AI models:

Model 1: {response1}

Model 2: {response2}

Model 3: {response3}

Please synthesize these responses into a comprehensive answer that combines the best insights from all three models while maintaining clarity and coherence.`
  )

  // Add these states near the other state declarations
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(true)
  const [showKnowledgeBaseModal, setShowKnowledgeBaseModal] = useState(false)
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false)
  const uppyRef = useRef<Uppy | null>(null)

  // Add the Uppy initialization useEffect
  useEffect(() => {
    if (!uppyRef.current) {
      const uppyInstance = UploadService.createUppy(
        'fusion-uploader',
        {
          maxFiles: 1,
          storageFolder: 'fusions',
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

  // Add the knowledge base loading useEffect
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

  // Add handlers
  const handleCloseUploadModal = () => {
    setShowUploadModal(false)
    if (uppyRef.current) {
      uppyRef.current.cancelAll()
    }
  }

  const handleRemoveFile = (file: UploadedFile) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== file.name))
  }

  // Function to synthesize responses
  const synthesizeResponses = async (originalPrompt: string, responses: string[]) => {
    try {
      const processedPrompt = synthesisPrompt
        .replace('{prompt}', originalPrompt)
        .replace('{response1}', responses[0])
        .replace('{response2}', responses[1])
        .replace('{response3}', responses[2])

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiHeaders(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: processedPrompt }],
          user_id: session?.user?.id,
          model_id: selectedModels['synthesis'],
          conversation_id: crypto.randomUUID(),
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      let firstChunkReceived = false

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
                if (!firstChunkReceived) {
                  setIsSynthesizing(false)
                  firstChunkReceived = true
                }
                assistantMessage += parsed.choices[0].delta.content
                setSynthesizedMessages(prev => {
                  const updated = [...prev]
                  if (updated.length === 0) {
                    return [{ role: 'assistant', content: assistantMessage }]
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
      console.error('Error in synthesis:', error)
      setError(error instanceof Error ? error : new Error('Unknown error during synthesis'))
      setIsSynthesizing(false)
    }
  }

  // Modified handleSubmit function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && uploadedFiles.length === 0) return

    setIsLoading(true)
    setIsSynthesizing(true)
    setError(null)

    const newMessage: Message = { role: 'user', content: input.trim() }
    setMessages1(prev => [...prev, newMessage])
    setMessages2(prev => [...prev, newMessage])
    setMessages3(prev => [...prev, newMessage])
    setSynthesizedMessages(prev => [...prev, newMessage])
    setInput('')

    const responses: string[] = []

    try {
      // Make three parallel API calls for the initial responses
      const apiCalls = [
        makeApiCall(messages1, setMessages1, 'chat1', responses, 0),
        makeApiCall(messages2, setMessages2, 'chat2', responses, 1),
        makeApiCall(messages3, setMessages3, 'chat3', responses, 2),
      ]

      await Promise.all(apiCalls)

      // After all responses are received, synthesize them
      await synthesizeResponses(input.trim(), responses)
    } catch (err) {
      console.error('Error in handleSubmit:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
      setUploadedFiles([])
    }
  }

  // Modified makeApiCall function
  const makeApiCall = async (
    prevMessages: Message[],
    setMessagesFunction: React.Dispatch<React.SetStateAction<Message[]>>,
    chatId: string,
    responses: string[],
    responseIndex: number
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

      responses[responseIndex] = assistantMessage
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

  useEffect(() => {
    if (allChatModels?.length > 0) {
      // Find the default model
      const defaultModel = allChatModels.find(model => model.default)
      if (!defaultModel) return

      // Get non-default models for other chat windows
      const otherModels = allChatModels
        .filter(model => !model.default && model.id !== defaultModel.id)
        .slice(0, 2) // We only need 2 other models now (for chat2 and chat3)

      setSelectedModels(prev => ({
        ...prev,
        chat1: defaultModel.id,
        chat2: otherModels[0]?.id || defaultModel.id,
        chat3: otherModels[1]?.id || defaultModel.id,
        synthesis: defaultModel.id // Set synthesis to use the same model as chat1
      }))
    }
  }, [allChatModels])

  // ... (keep other utility functions from chat/page.tsx)

  // Add a prompt editor modal component
  const SynthesisPromptModal = ({ 
    isOpen, 
    onClose, 
    prompt, 
    onSave 
  }: { 
    isOpen: boolean
    onClose: () => void
    prompt: string
    onSave: (prompt: string) => void 
  }) => {
    const [editedPrompt, setEditedPrompt] = useState(prompt)

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-1-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Synthesis Prompt</DialogTitle>
            <DialogDescription>
              Use {'{prompt}'}, {'{response1}'}, {'{response2}'}, and {'{response3}'} as variables.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="min-h-[200px]"
            />
          </div>
          <DialogFooter>
            <Button onClick={() => {
              onSave(editedPrompt)
              onClose()
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Add state for the modal
  const [showSynthesisPromptModal, setShowSynthesisPromptModal] = useState(false)

  // Add this function near the other handlers
  const handlePromptSelect = (prompt: any) => {
    if (prompt.variables && prompt.variables.length > 0) {
      setSelectedComplexPrompt(prompt)
    } else {
      setInput(prompt.content)
    }
  }

  // Add this handler for complex prompts
  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    setInput(generatedPrompt)
    setSelectedComplexPrompt(null)
  }

  // Add this function near the other handlers
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

  // Add this function near the other handlers
  const addToScratchPad = async (content: string) => {
    try {
      await addToScratchPadService(content)
    } catch (err) {
      console.error('Failed to add to scratch pad:', err)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* LEFT COLUMN (sidebar) */}
      <div className="w-64 h-full border-r border-gray-200">
        <AppSidebar />
      </div>

      {/* RIGHT COLUMN (main content) */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Top row with three chat windows */}
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4 h-[300px]">
            {[
              { messages: messages1, chatId: 'chat1' },
              { messages: messages2, chatId: 'chat2' },
              { messages: messages3, chatId: 'chat3' },
            ].map((chat, index) => (
              <div key={index} className="h-full border rounded-lg bg-white overflow-hidden">
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
                </div>
                <ScrollArea className="h-[calc(100%-60px)] p-4">
                  {chat.messages.map((message, msgIndex) => (
                    <ChatMessage
                      key={msgIndex}
                      role={message.role}
                      content={message.content}
                      avatar={null}
                    />
                  ))}
                </ScrollArea>
              </div>
            ))}
          </div>

          {/* Bottom synthesized response window */}
          <div className="flex-1 border rounded-lg bg-white overflow-hidden relative">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center gap-2">
                <span className="font-medium">Synthesized Response</span>
                <div className="flex gap-2">
                  <div className="w-[180px]">
                    <ComboboxPersonas
                      personas={personas || []}
                      value={selectedPersonas['synthesis']}
                      onSelect={(persona) => handlePersonaChange('synthesis', persona.id.toString())}
                    />
                  </div>
                  <div className="w-[180px]">
                    <ComboboxChatModels
                      models={allChatModels || []}
                      value={selectedModels['synthesis']}
                      onSelect={(model) => handleModelChange('synthesis', model.id)}
                    />
                  </div>
                </div>
              </div>
              {/* Add copy and scratch pad buttons */}
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8" 
                        onClick={() => copyToClipboard(synthesizedMessages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                      >
                        {copiedStates[synthesizedMessages.map(m => `${m.role}: ${m.content}`).join('\n')] ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {copiedStates[synthesizedMessages.map(m => `${m.role}: ${m.content}`).join('\n')] 
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
                        onClick={() => addToScratchPad(synthesizedMessages.map(m => `${m.role}: ${m.content}`).join('\n'))}
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
              {isSynthesizing && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-sm text-muted-foreground">Generating synthesis...</span>
                  </div>
                </div>
              )}
              {synthesizedMessages.map((message, index) => (
                <ChatMessage
                  key={index}
                  role={message.role}
                  content={message.content}
                  avatar={null}
                />
              ))}
            </ScrollArea>
          </div>
        </div>

        {/* Footer (input) */}
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
                    className={isWebSearchEnabled ? "text-green-500" : ""}
                  >
                    <Globe2 className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enable Web Search</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setShowSynthesisPromptModal(true)}
          >
            <Settings className="h-4 w-4" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>Edit Synthesis Prompt</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit Synthesis Prompt</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Button>

          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="Type a message..."
            className="flex-1"
          />

          <Button onClick={e => handleSubmit(e)} disabled={isLoading || (!input.trim() && !uploadedFiles.length)}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>

          <SynthesisPromptModal
            isOpen={showSynthesisPromptModal}
            onClose={() => setShowSynthesisPromptModal(false)}
            prompt={synthesisPrompt}
            onSave={setSynthesisPrompt}
          />
        </div>
      </div>

      {/* Add the modals */}
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

      {/* File upload modal */}
      {showUploadModal && uppyRef.current && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-2xl w-full">
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

      {/* File upload pills */}
      {uploadedFiles.length > 0 && (
        <div className="absolute bottom-[72px] left-0 right-0 p-2 bg-background border-t">
          <FileUploadPills files={uploadedFiles} onRemove={handleRemoveFile} />
        </div>
      )}

      {/* Complex Prompt Modal */}
      {selectedComplexPrompt && (
        <ComplexPromptModal
          prompt={selectedComplexPrompt}
          isOpen={!!selectedComplexPrompt}
          onClose={() => setSelectedComplexPrompt(null)}
          onSubmit={handleComplexPromptSubmit}
        />
      )}
    </div>
  )
}

export default function Fusion() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FusionContent />
    </Suspense>
  )
} 