'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Copy, Trash2, Send, BookOpen, Loader2, Bot, Sparkles, SmilePlus, Check, FileText, Paperclip, X, Database, Globe2
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

  // ... (keep other state and refs from chat/page.tsx)

  // Function to synthesize responses
  const synthesizeResponses = async (originalPrompt: string, responses: string[]) => {
    const synthesisPrompt = `Given this prompt: "${originalPrompt}" and these results from different AI models:

Model 1: ${responses[0]}

Model 2: ${responses[1]}

Model 3: ${responses[2]}

Please synthesize these responses into a comprehensive answer that combines the best insights from all three models while maintaining clarity and coherence.`

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiHeaders(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: synthesisPrompt }],
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
    }
  }

  // Modified handleSubmit function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && uploadedFiles.length === 0) return

    setIsLoading(true)
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

  useEffect(() => {
    if (allChatModels?.length > 0) {
      // Find the default model
      const defaultModel = allChatModels.find(model => model.default)
      if (!defaultModel) return

      // Get non-default models for other chat windows
      const otherModels = allChatModels
        .filter(model => !model.default && model.id !== defaultModel.id)
        .slice(0, 3) // We need 3 other models for chat1, chat2, chat3, synthesis

      setSelectedModels(prev => ({
        ...prev,
        chat1: defaultModel.id,
        chat2: otherModels[0]?.id || defaultModel.id,
        chat3: otherModels[1]?.id || defaultModel.id,
        synthesis: otherModels[2]?.id || defaultModel.id
      }))
    }
  }, [allChatModels])

  // ... (keep other utility functions from chat/page.tsx)

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* LEFT COLUMN (sidebar) */}
      <div className="w-64 h-full border-r border-gray-200">
        <AppSidebar />
      </div>

      {/* RIGHT COLUMN (main content) */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Top row with three chat windows */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-3 gap-4 h-[45%] mb-4">
            {[
              { messages: messages1, chatId: 'chat1' },
              { messages: messages2, chatId: 'chat2' },
              { messages: messages3, chatId: 'chat3' },
            ].map((chat, index) => (
              <div key={index} className="h-full border rounded-lg bg-white overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-[200px]">
                      <ComboboxChatModels
                        models={allChatModels || []}
                        value={selectedModels[chat.chatId]}
                        onSelect={(model) => handleModelChange(chat.chatId, model.id)}
                      />
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
          <div className="h-[45%] border rounded-lg bg-white overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center gap-2">
                <span className="font-medium">Synthesized Response</span>
                <div className="w-[200px]">
                  <ComboboxChatModels
                    models={allChatModels || []}
                    value={selectedModels['synthesis']}
                    onSelect={(model) => handleModelChange('synthesis', model.id)}
                  />
                </div>
              </div>
            </div>
            <ScrollArea className="h-[calc(100%-60px)] p-4">
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
        </div>
      </div>
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