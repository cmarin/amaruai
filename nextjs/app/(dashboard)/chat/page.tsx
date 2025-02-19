'use client';

import React, { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ChevronDown } from "lucide-react"
import { useData } from '@/components/data-context'
import { AppSidebar } from '@/components/app-sidebar'
import ChatMessage from '@/components/chat-message'
import ActionSearchBar from "@/components/kokonutui/action-search-bar"
import { Persona } from "@/utils/persona-service"
import { ComboboxPersonas } from "@/components/combobox-personas"
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { PromptSelector } from '@/components/prompt-selector'
import { ComplexPromptModal } from '@/components/complex-prompt-modal'
import { addToScratchPad } from '@/utils/scratch-pad-service'
import { OpenAIIcon, AnthropicIcon, GeminiIcon, PerplexityIcon, MistralIcon, MetaIcon, ZephyrIcon } from '@/components/icons/ai-provider-icons'

import {
  Copy, Trash2, Send, BookOpen, Grid2X2, Columns, Square, MessageSquare,
  Loader2, Timer, Bot, Sparkles, SmilePlus, Check, FileText, Paperclip, X, Database, Globe2
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSidebar } from '@/components/sidebar-context'
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
import { ChatModel } from '@/utils/chat-model-service'

// Import required Uppy CSS
import '@uppy/core/dist/style.min.css'
import '@uppy/dashboard/dist/style.min.css'

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWindowProps {
  messages: Message[];
  chatWindowId: number;
  onSendMessage: (e: React.FormEvent) => Promise<void>;
  onClear: () => void;
  onCopy: () => void;
  onAddToScratchPad: () => void;
  isLoading: boolean;
  error: string | null;
}

function ChatContent() {
  const { sidebarOpen } = useSidebar()
  const { promptTemplates: prompts, categories, chatModels: allChatModels, personas } = useData()
  const { session, getApiHeaders } = useSession()
  const supabase = useSupabase()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [messages, setMessages] = useState<Message[]>([])
  const [messages2, setMessages2] = useState<Message[]>([])
  const [messages3, setMessages3] = useState<Message[]>([])
  const [messages4, setMessages4] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'single' | 'dual' | 'quad'>('single')
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [selectedComplexPrompt, setSelectedComplexPrompt] = useState<any | null>(null)
  const [selectedModels, setSelectedModels] = useState<{ [key: number]: string }>({})
  const [selectedPersonas, setSelectedPersonas] = useState<{ [key: number]: string | number }>({})
  const [hasUserChangedModel, setHasUserChangedModel] = useState(false)
  const [hasUserChangedPersona, setHasUserChangedPersona] = useState(false)
  const [activePersonaSearchIndex, setActivePersonaSearchIndex] = useState<number | null>(null);
  const personaSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('Personas changed:', personas);
  }, [personas]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (personaSearchRef.current && !personaSearchRef.current.contains(event.target as Node)) {
        setActivePersonaSearchIndex(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [conversationIds, setConversationIds] = useState<{ [key: number]: string }>({})
  const [multiConversationId, setMultiConversationId] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(true)
  const [retryAttempts, setRetryAttempts] = useState<{ [key: number]: number }>({})
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [showKnowledgeBaseModal, setShowKnowledgeBaseModal] = useState(false);

  const uppyRef = useRef<Uppy | null>(null)

  useEffect(() => {
    if (!uppyRef.current) {
      const uppyInstance = UploadService.createUppy(
        'chat-uploader',
        {
          maxFiles: 1,
          storageFolder: 'chats',
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

  useEffect(() => {
    const defaultModel = allChatModels?.find(model => model.default) || allChatModels?.[0]
    const otherModels = allChatModels?.filter(model => !model.default && model.id !== defaultModel?.id) || []

    if (defaultModel) {
      const newModelSelections: { [key: number]: string } = { 1: defaultModel.id }

      // Only add other models if they exist
      if (mode !== 'single' && otherModels[0]) {
        newModelSelections[2] = otherModels[0].id
      }
      
      if (mode === 'quad') {
        if (otherModels[1]) {
          newModelSelections[3] = otherModels[1].id
        }
        if (otherModels[2]) {
          newModelSelections[4] = otherModels[2].id
        }
      }

      setSelectedModels(newModelSelections)
    }
  }, [allChatModels, mode])

  useEffect(() => {
    const modelId = searchParams.get('model')
    if (modelId && allChatModels?.some(model => model.id === modelId)) {
      setSelectedModels(prev => ({ ...prev, 1: modelId }))
    }
  }, [searchParams, allChatModels])

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef2 = useRef<HTMLDivElement>(null);
  const messagesEndRef3 = useRef<HTMLDivElement>(null);
  const messagesEndRef4 = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef<boolean>(false);
  const wasAtBottomRef = useRef<boolean>(true);

  const isAtBottom = useCallback((containerRef: HTMLElement) => {
    const threshold = 100; // pixels from bottom
    const position = containerRef.scrollTop + containerRef.clientHeight;
    const height = containerRef.scrollHeight;
    return position > height - threshold;
  }, []);

  const maintainScroll = useCallback((containerRef: HTMLElement) => {
    if (!containerRef) return;
    
    // If we were at the bottom before the update, scroll to bottom
    if (wasAtBottomRef.current) {
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.target as HTMLDivElement;
    wasAtBottomRef.current = isAtBottom(container);
  }, [isAtBottom]);

  const getModelIcon = (modelId: string, modelName: string) => {
    const nameLower = modelName.toLowerCase()
    if (nameLower.includes('gpt')) return <OpenAIIcon className="w-full h-full" aria-hidden="true" />
    if (nameLower.includes('claude')) return <AnthropicIcon className="w-full h-full" aria-hidden="true" />
    if (nameLower.includes('gemini')) return <GeminiIcon className="w-full h-full" aria-hidden="true" />
    if (nameLower.includes('pplx')) return <PerplexityIcon className="w-full h-full" aria-hidden="true" />
    if (nameLower.includes('mistral')) return <MistralIcon className="w-full h-full" aria-hidden="true" />
    if (nameLower.includes('llama')) return <MetaIcon className="w-full h-full" aria-hidden="true" />
    if (nameLower.includes('zephyr')) return <ZephyrIcon className="w-full h-full" aria-hidden="true" />
    return <Bot className="w-full h-full" aria-hidden="true" />
  }

  const getModelName = (chatWindowId: number) => {
    const modelId = selectedModels[chatWindowId]
    const model = allChatModels?.find((m: ChatModel) => m.id === modelId)
    return model?.name || 'Select model...'
  }

  const getPersonaName = (chatWindowId: number) => {
    const personaId = selectedPersonas[chatWindowId]
    const persona = personas?.find((p: Persona) => p.id.toString() === personaId?.toString())
    return persona?.role || 'Select persona...'
  }

  const handleModelChange = (chatWindowId: number, modelId: string) => {
    setSelectedModels(prev => ({
      ...prev,
      [chatWindowId]: modelId
    }))
  }

  const handlePersonaChange = (chatWindowId: number, value: string | number) => {
    setSelectedPersonas((prev) => ({
      ...prev,
      [chatWindowId]: value
    }));
    setHasUserChangedPersona(true);
  }

  const handleFileUpload = async (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];
      const uploadedFile: UploadedFile = {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadURL: file.uploadURL
      };
      setUploadedFiles(prev => [...prev, uploadedFile]);
    }
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

  // Submit user input to all relevant LLMs
  const handleError = (error: Error | string) => {
    setError(typeof error === 'string' ? error : error.message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && uploadedFiles.length === 0) return

    try {
      setIsLoading(true)
      setError(null)
      // Reset retry attempts for new chat
      resetRetryAttempts()

      const newMessage: Message = { role: 'user', content: input.trim() }
      setMessages(prev => [...prev, newMessage])
      setMessages2(prev => [...prev, newMessage])
      setMessages3(prev => [...prev, newMessage])
      setMessages4(prev => [...prev, newMessage])
      setInput('')

      // Generate a new multi_conversation_id if in multi-chat mode and none exists
      let currentMultiConversationId = multiConversationId
      if ((mode === 'dual' || mode === 'quad') && !currentMultiConversationId) {
        currentMultiConversationId = `multi-${Date.now()}`
        setMultiConversationId(currentMultiConversationId)
      }

      // Shared streaming logic
      const makeApiCall = async (
        prevMessagesLocal: Message[],
        setMessagesFunction: React.Dispatch<React.SetStateAction<Message[]>>,
        chatId: number,
        isRetry: boolean = false // Add isRetry parameter
      ) => {
        // Don't allow more than one retry per chat window
        if (isRetry) {
          const currentRetries = retryAttempts[chatId] || 0
          if (currentRetries > 0) {
            console.log(`Already retried chat ${chatId}, skipping further retries`)
            return
          }
          // Mark this chat window as having been retried
          setRetryAttempts(prev => ({
            ...prev,
            [chatId]: (prev[chatId] || 0) + 1
          }))
        }

        try {
          isStreamingRef.current = true;
          // Get or create conversation_id for this chat window
          let currentConversationId = conversationIds[chatId]
          if (!currentConversationId) {
            currentConversationId = `conv-${Date.now()}`
            setConversationIds(prev => ({
              ...prev,
              [chatId]: currentConversationId
            }))
          }

          // Get the selected model and persona for this chat
          const modelId = isRetry ? undefined : (selectedModels[chatId] || allChatModels?.[0]?.id)
          const personaId = selectedPersonas[chatId]
          const selectedModel = modelId ? allChatModels?.find(model => model.id === modelId) : undefined
          const selectedPersona = personas?.find(p => p.id.toString() === personaId.toString())

          let streamStartTime: number | null = null
          let receivedFirstChunk = false
          let hasReceivedContent = false
          let chunkCount = 0

          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getApiHeaders(),
            },
            body: JSON.stringify({ 
              messages: [...prevMessagesLocal, newMessage],
              user_id: session?.user?.id,
              model_id: selectedModel?.id,
              persona_id: selectedPersona?.id,
              files: uploadedFiles.map(f => ({ name: f.name, url: f.uploadURL })),
              conversation_id: currentConversationId,
              knowledge_base_ids: selectedKnowledgeBases.map(kb => kb.id),
              asset_ids: selectedAssets.map(asset => asset.id),
              ...(currentMultiConversationId && { multi_conversation_id: currentMultiConversationId }),
              web: isWebSearchEnabled
            }),
          })

          if (!response.ok || !response.body) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()

          let assistantMessage = ''
          let hasCreatedAssistantMessage = false
          // Removed initial empty message creation

          streamStartTime = Date.now()

          while (true) {
            const timeElapsed = Date.now() - streamStartTime
            if (timeElapsed > 10000 && (!receivedFirstChunk || (chunkCount === 1 && !hasReceivedContent))) {
              throw new Error('Stream timeout - no meaningful content received within 10 seconds')
            }

            const { value, done } = await reader.read()
            if (done) {
              if (chunkCount > 0 && !hasReceivedContent) {
                throw new Error('Stream completed with only empty chunks')
              }
              isStreamingRef.current = false;
              if (chatContainerRef.current) {
                chatContainerRef.current.style.overflowY = 'auto';
              }
              break
            }

            if (!receivedFirstChunk) {
              receivedFirstChunk = true
            }

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                chunkCount++
                const jsonData = line.slice(5).trim()
                if (jsonData === '[DONE]') continue

                try {
                  const jsonString = jsonData
                  const openBraces = (jsonString.match(/{/g) || []).length
                  const closeBraces = (jsonString.match(/}/g) || []).length
                
                  if (openBraces !== closeBraces || (openBraces > 0 && !jsonString.trim().endsWith('}'))) {
                    console.warn('Skipping incomplete JSON chunk:', jsonString)
                    continue
                  }

                  const parsed = JSON.parse(jsonString)
                  if (parsed.choices?.[0]?.delta?.content) {
                    hasReceivedContent = true
                    assistantMessage += parsed.choices[0].delta.content
                  
                    if (!hasCreatedAssistantMessage) {
                      hasCreatedAssistantMessage = true
                      setMessagesFunction(prev => [...prev, { role: 'assistant', content: assistantMessage }])
                    } else {
                      setMessagesFunction(prev => {
                        const updated = [...prev]
                        updated[updated.length - 1] = {
                          role: 'assistant',
                          content: assistantMessage,
                        }
                        if (chatContainerRef.current) {
                          chatContainerRef.current.style.overflowY = 'auto';
                        }
                        return updated
                      })
                    }
                  }
                } catch (parseError) {
                  console.warn('Error parsing chunk, skipping:', parseError)
                  console.warn('Problematic chunk:', jsonData)
                  continue
                }
              }
            }
          }
        } catch (err: any) {
          isStreamingRef.current = false;
          if (chatContainerRef.current) {
            chatContainerRef.current.style.overflowY = 'auto';
          }
          console.error('Error in API call:', err)

          // If this is a timeout error or empty chunk error, retry without model_id
          if ((err.message.includes('timeout') || err.message.includes('empty chunk')) && !isRetry) {
            console.log('Retrying stream without specific model for', chatId)
            try {
              // Retry the API call without the model_id
              return makeApiCall(prevMessagesLocal, setMessagesFunction, chatId, true)
            } catch (retryErr) {
              console.error('Retry also failed:', retryErr)
              const errMsg = retryErr instanceof Error ? retryErr.message : 'Unknown error'
              handleError(errMsg);
            }
          } else {
            const errMsg = err instanceof Error ? err.message : 'Unknown error'
            handleError(errMsg);
          }
        }
      }

      const apiCalls = [
        makeApiCall(messages, setMessages, 1),
        mode !== 'single' && makeApiCall(messages2, setMessages2, 2),
        mode === 'quad' && makeApiCall(messages3, setMessages3, 3),
        mode === 'quad' && makeApiCall(messages4, setMessages4, 4),
      ].filter(Boolean)

      try {
        // Use Promise.allSettled instead of Promise.all to handle individual failures
        const results = await Promise.allSettled(apiCalls)
        
        // Log any failures for debugging
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const chatId = [1, 2, 3, 4][index]
            console.error(`Chat ${chatId} failed:`, result.reason)
            
            // Set error message for failed chats
            const errMsg = result.reason instanceof Error ? result.reason.message : 'Unknown error'
            handleError(errMsg);
          }
        })
      } catch (err: unknown) {
        console.error('Error in handleSubmit:', err)
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        handleError(errMsg);
      } finally {
        setIsLoading(false)
        setUploadedFiles([])
      }
    } catch (err: any) {
      handleError(err);
    } finally {
      setIsLoading(false)
    }
  }

  // Copy all messages to clipboard
  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      const key = `copy-${Date.now()}`
      setCopiedStates(prev => ({ ...prev, [key]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }))
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      handleError(err instanceof Error ? err.message : 'Failed to copy to clipboard')
    }
  }

  // Add conversation to scratch pad
  const addToScratchPad = async (content: string) => {
    try {
      await addToScratchPad(content)
    } catch (err) {
      console.error('Failed to add to scratch pad:', err)
      handleError(err instanceof Error ? err.message : 'Failed to add to scratch pad')
    }
  }

  // Clear entire conversation for a given messages array
  const clearConversation = (messagesList: Message[]) => {
    if (messagesList === messages) {
      setMessages([])
    } else if (messagesList === messages2) {
      setMessages2([])
    } else if (messagesList === messages3) {
      setMessages3([])
    } else if (messagesList === messages4) {
      setMessages4([])
    }
  }

  // Handles prompt selection
  const handlePromptSelect = (prompt: any) => {
    // Only update model/persona for first chat window if user hasn't changed them
    if (!hasUserChangedModel && prompt.default_chat_model_id) {
      setSelectedModels(prev => ({ ...prev, 1: prompt.default_chat_model_id! }))
    }
    if (!hasUserChangedPersona && prompt.default_persona_id) {
      setSelectedPersonas(prev => ({ ...prev, 1: prompt.default_persona_id! }))
    }

    // Set the prompt content
    setInput(prompt.prompt)
    if (prompt.is_complex) {
      setSelectedComplexPrompt(prompt)
    }
  }

  // For complex prompts
  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    setInput(prevInput => (prevInput ? prevInput + ' ' : '') + generatedPrompt)
    setSelectedComplexPrompt(null)
  }

  // Reset retry attempts when starting a new chat
  const resetRetryAttempts = () => {
    setRetryAttempts({})
  }

  // Add mode change handler
  const handleModeChange = (newMode: 'single' | 'dual' | 'quad') => {
    setMode(newMode)
    
    // Clear all conversations
    clearConversation(messages)
    clearConversation(messages2)
    clearConversation(messages3)
    clearConversation(messages4)

    // Reset retry attempts and conversation tracking
    setRetryAttempts({})
    setConversationIds({})
    setMultiConversationId(null)

    const defaultModel = allChatModels?.find(model => model.default) || allChatModels?.[0]
    const otherModels = allChatModels?.filter(model => !model.default && model.id !== defaultModel?.id) || []

    if (defaultModel) {
      const newModelSelections: { [key: number]: string } = { 1: defaultModel.id }

      // Only add other models if they exist
      if (newMode !== 'single' && otherModels[0]) {
        newModelSelections[2] = otherModels[0].id
      }
      
      if (newMode === 'quad') {
        if (otherModels[1]) {
          newModelSelections[3] = otherModels[1].id
        }
        if (otherModels[2]) {
          newModelSelections[4] = otherModels[2].id
        }
      }

      setSelectedModels(newModelSelections)
    }
  }

  // Add toggleChatbot handler
  const handleToggleChatbot = (modelId: string) => {
    // Update the URL
    router.push(`/chat?model=${modelId}`, { scroll: false })
    // Update the selected model
    setSelectedModels(prev => ({
      ...prev,
      1: modelId
    }))
  }

  // Handle persona selection for a specific chat
  const handlePersonaSelect = (chatIndex: number) => (persona: Persona) => {
    setSelectedPersonas(prev => ({
      ...prev,
      [chatIndex]: persona.id
    }));
    setHasUserChangedPersona(true);
    setActivePersonaSearchIndex(null);
  };

  const ChatWindow: React.FC<ChatWindowProps> = ({
    messages,
    chatWindowId,
    onSendMessage,
    onClear,
    onCopy,
    onAddToScratchPad,
    isLoading,
    error
  }) => {
    const selectedPersona = personas?.find(p => 
      p.id.toString() === selectedPersonas[chatWindowId]?.toString()
    );
    
    return (
      <TooltipProvider>
        <div className="flex flex-col h-full">
          {/* Top header (title, copy, clear) */}
          <div className="flex justify-between items-center p-4 border-b">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5">
                  {getModelIcon(selectedModels[chatWindowId] || '', getModelName(chatWindowId))}
                </span>
                <span className="font-medium">{getModelName(chatWindowId)}</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                  <ComboboxPersonas
                    personas={personas}
                    value={selectedPersonas[chatWindowId]}
                    onSelect={(persona: Persona) => handlePersonaSelect(chatWindowId)(persona)}
                  />
                </div>
                <Select
                  value={selectedModels[chatWindowId] || ''}
                  onValueChange={(value) => handleModelChange(chatWindowId, value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {allChatModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center">
                          {model.provider === 'openai' && <OpenAIIcon className="w-4 h-4 mr-2" />}
                          {model.provider === 'anthropic' && <AnthropicIcon className="w-4 h-4 mr-2" />}
                          {model.provider === 'google' && <GeminiIcon className="w-4 h-4 mr-2" />}
                          {model.provider === 'perplexity' && <PerplexityIcon className="w-4 h-4 mr-2" />}
                          {model.provider === 'mistral' && <MistralIcon className="w-4 h-4 mr-2" />}
                          {model.provider === 'meta' && <MetaIcon className="w-4 h-4 mr-2" />}
                          {model.provider === 'zephyr' && <ZephyrIcon className="w-4 h-4 mr-2" />}
                          {model.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Copy, add to scratch pad, clear */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onCopy}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Copy chat content
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onAddToScratchPad}>
                    <FileText className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to Scratch Pad</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onClear}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear Conversation</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Chat messages area */}
          <ScrollArea 
            className="flex-1 p-4 relative" 
            onScroll={handleScroll}
            ref={chatContainerRef}
          >
            <div className="space-y-4">
              {messages.map((message, index) => (
                <ChatMessage
                  key={index}
                  role={message.role}
                  content={message.content}
                  avatar={message.role === 'assistant' ? selectedPersona?.avatar : null}
                />
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </div>
            {isLoading && (
              <div className="sticky bottom-4 w-full flex justify-center">
                <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating response...</span>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </TooltipProvider>
    );
  };

  const loadAssets = useCallback(async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        throw new Error('No API headers available');
      }
      const assets = await fetchAssets(headers);
      setAssets(assets);
    } catch (err) {
      console.error('Error loading assets:', err)
      handleError(err instanceof Error ? err.message : 'Failed to load assets')
    }
  }, [getApiHeaders]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* LEFT COLUMN (sidebar) */}
      <div className="w-64 h-full border-r border-gray-200">
        <AppSidebar toggleChatbot={handleToggleChatbot} />
      </div>

      {/* RIGHT COLUMN (main content) */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Body/Chat section (scrollable) */}
        <div className="flex-1 overflow-auto p-4">
          {/* Single/dual/quad chat windows */}
          {mode === 'single' ? (
            <div className="grid h-full grid-cols-1 gap-4">
              <Suspense fallback={<div>Loading...</div>}>
                {/* Chat Panel 1 */}
                <div className="flex flex-col border rounded-lg overflow-hidden bg-background">
                  <ChatWindow
                    messages={messages}
                    chatWindowId={1}
                    onSendMessage={handleSubmit}
                    onClear={() => clearConversation(messages)}
                    onCopy={() => copyToClipboard(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                    onAddToScratchPad={() => addToScratchPad(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                    isLoading={isLoading}
                    error={error}
                  />
                </div>
              </Suspense>
            </div>
          ) : (
            <div
              className={`grid h-full ${mode === 'quad' ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2'} gap-4`}
            >
              <Suspense fallback={<div>Loading...</div>}>
                <ChatWindow
                  messages={messages}
                  chatWindowId={1}
                  onSendMessage={handleSubmit}
                  onClear={() => clearConversation(messages)}
                  onCopy={() => copyToClipboard(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                  onAddToScratchPad={() => addToScratchPad(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                  isLoading={isLoading}
                  error={error}
                />
              </Suspense>
              <Suspense fallback={<div>Loading...</div>}>
                <ChatWindow
                  messages={messages2}
                  chatWindowId={2}
                  onSendMessage={handleSubmit}
                  onClear={() => clearConversation(messages2)}
                  onCopy={() => copyToClipboard(messages2.map(m => `${m.role}: ${m.content}`).join('\n'))}
                  onAddToScratchPad={() => addToScratchPad(messages2.map(m => `${m.role}: ${m.content}`).join('\n'))}
                  isLoading={isLoading}
                  error={error}
                />
              </Suspense>
              {mode === 'quad' && (
                <>
                  <Suspense fallback={<div>Loading...</div>}>
                    <ChatWindow
                      messages={messages3}
                      chatWindowId={3}
                      onSendMessage={handleSubmit}
                      onClear={() => clearConversation(messages3)}
                      onCopy={() => copyToClipboard(messages3.map(m => `${m.role}: ${m.content}`).join('\n'))}
                      onAddToScratchPad={() => addToScratchPad(messages3.map(m => `${m.role}: ${m.content}`).join('\n'))}
                      isLoading={isLoading}
                      error={error}
                    />
                  </Suspense>
                  <Suspense fallback={<div>Loading...</div>}>
                    <ChatWindow
                      messages={messages4}
                      chatWindowId={4}
                      onSendMessage={handleSubmit}
                      onClear={() => clearConversation(messages4)}
                      onCopy={() => copyToClipboard(messages4.map(m => `${m.role}: ${m.content}`).join('\n'))}
                      onAddToScratchPad={() => addToScratchPad(messages4.map(m => `${m.role}: ${m.content}`).join('\n'))}
                      isLoading={isLoading}
                      error={error}
                    />
                  </Suspense>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer (input / mode toggle) */}
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
                <p>Prompts</p>
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
                />
              </TooltipTrigger>
              <TooltipContent className="bg-white">
                <p>Add Knowledge Base or Asset</p>
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
                <TooltipContent className="bg-white">
                  <p>Enable Web Search</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

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

          {/* Mode selection buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant={mode === 'single' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setMode('single')}
              title="Single chat"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              variant={mode === 'dual' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setMode('dual')}
              title="Split view"
            >
              <Columns className="h-4 w-4" />
            </Button>
            <Button
              variant={mode === 'quad' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setMode('quad')}
              title="Grid view"
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* File upload pills */}
        {uploadedFiles.length > 0 && (
          <div className="absolute bottom-[72px] left-0 right-0 p-2 bg-background border-t">
            <FileUploadPills files={uploadedFiles} onRemove={handleRemoveFile} />
          </div>
        )}
      </div>

      {/* Complex prompt modal */}
      {selectedComplexPrompt && (
        <ComplexPromptModal
          prompt={selectedComplexPrompt}
          isOpen={!!selectedComplexPrompt}
          onClose={() => setSelectedComplexPrompt(null)}
          onSubmit={handleComplexPromptSubmit}
        />
      )}

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
    </div>
  )
}

export default function Chat() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatContent />
    </Suspense>
  )
}