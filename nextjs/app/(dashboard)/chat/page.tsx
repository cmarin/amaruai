'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Copy, Trash2, Send, BookOpen, Grid2X2, Columns, Square, MessageSquare,
  Loader2, Timer, Bot, Sparkles, SmilePlus, Check, FileText, Paperclip, X, Database, ChevronDown, Globe2
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { isMarkdown } from '@/app/utils/isMarkdown'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { PromptSelector } from '@/components/prompt-selector'
import { useData } from '@/components/data-context'
import { addToScratchPad as addToScratchPadService } from '@/utils/scratch-pad-service'
import { ComplexPromptModal } from '@/components/complex-prompt-modal'
import { OpenAIIcon, AnthropicIcon, GeminiIcon, PerplexityIcon, MistralIcon, MetaIcon, ZephyrIcon } from '@/components/icons/ai-provider-icons'
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
import { ChatModel } from '@/components/data-context'
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
  const [error, setError] = useState<Error | null>(null)
  const [mode, setMode] = useState<'single' | 'dual' | 'quad'>('single')
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [selectedComplexPrompt, setSelectedComplexPrompt] = useState<any | null>(null)
  const [selectedModels, setSelectedModels] = useState<{ [key: string]: string }>({})
  const [selectedPersonas, setSelectedPersonas] = useState<{ [key: string]: string }>({})
  const [hasUserChangedModel, setHasUserChangedModel] = useState(false)
  const [hasUserChangedPersona, setHasUserChangedPersona] = useState(false)
  
  // State variables to track streaming status for each chat window
  const [isStreaming1, setIsStreaming1] = useState(false)
  const [isStreaming2, setIsStreaming2] = useState(false)
  const [isStreaming3, setIsStreaming3] = useState(false)
  const [isStreaming4, setIsStreaming4] = useState(false)

  // Map chat IDs to their streaming state setters
  const streamingSetters: { [key: string]: React.Dispatch<React.SetStateAction<boolean>> } = {
    chat1: setIsStreaming1,
    chat2: setIsStreaming2,
    chat3: setIsStreaming3,
    chat4: setIsStreaming4
  }

  const [conversationIds, setConversationIds] = useState<{ [key: string]: string }>({})
  const [multiConversationId, setMultiConversationId] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(true)
  const [retryAttempts, setRetryAttempts] = useState<{ [key: string]: number }>({})
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [showKnowledgeBaseModal, setShowKnowledgeBaseModal] = useState(false);

  const uppyRef = useRef<Uppy | null>(null)

  // Replace single isStreamingRef with a map of streaming states
  const streamingStatesRef = useRef<{ [key: string]: boolean }>({
    chat1: false,
    chat2: false,
    chat3: false,
    chat4: false
  });

  // Add refs for each chat container
  const chatContainerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({
    chat1: null,
    chat2: null,
    chat3: null,
    chat4: null
  });

  // Track which windows were at the bottom before streaming started
  const wasAtBottomBeforeStreamingRef = useRef<{ [key: string]: boolean }>({
    chat1: true,
    chat2: true,
    chat3: true,
    chat4: true
  });

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
    if (allChatModels?.length > 0) {
      // Find the default model
      const defaultModel = allChatModels.find(model => model.default)
      if (!defaultModel) return

      // Get non-default models for other chat windows
      const otherModels = allChatModels
        .filter(model => !model.default && model.id !== defaultModel.id)
        .slice(0, 3) // We need at most 3 other models for chat2, chat3, chat4

      setSelectedModels(prev => ({
        ...prev,
        chat1: defaultModel.id,
        ...(mode !== 'single' && otherModels[0] && { chat2: otherModels[0].id }),
        ...(mode === 'quad' && otherModels[1] && { chat3: otherModels[1].id }),
        ...(mode === 'quad' && otherModels[2] && { chat4: otherModels[2].id })
      }))
    }
  }, [allChatModels, mode])

  useEffect(() => {
    const modelId = searchParams.get('model')
    if (modelId && allChatModels?.some(model => model.id === modelId)) {
      setSelectedModels(prev => ({
        ...prev,
        chat1: modelId
      }))
    }
  }, [searchParams, allChatModels])

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef2 = useRef<HTMLDivElement>(null);
  const messagesEndRef3 = useRef<HTMLDivElement>(null);
  const messagesEndRef4 = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef<boolean>(true);

  const isAtBottom = useCallback((containerRef: HTMLElement) => {
    const threshold = 100; // pixels from bottom
    const position = containerRef.scrollTop + containerRef.clientHeight;
    const height = containerRef.scrollHeight;
    return height - position <= threshold;
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

  const getProviderIcon = (modelId: string, modelName: string) => {
    const nameLower = modelName.toLowerCase()
    
    if (nameLower.includes('gpt') || nameLower.includes('o1')) return OpenAIIcon
    if (nameLower.includes('claude')) return AnthropicIcon
    if (nameLower.includes('gemini')) return GeminiIcon
    if (nameLower.includes('perplexity')) return PerplexityIcon
    if (nameLower.includes('mistral') || nameLower.includes('mixtral')) return MistralIcon
    if (nameLower.includes('llama')) return MetaIcon
    if (nameLower.includes('zephyr')) return ZephyrIcon
    return MessageSquare as React.ComponentType<any>
  }

  const handleModelChange = (chatWindowId: string, modelId: string) => {
    setSelectedModels(prev => ({ ...prev, [chatWindowId]: modelId }))
    setHasUserChangedModel(true)
    // Reset retry attempts when manually changing model
    setRetryAttempts(prev => ({ ...prev, [chatWindowId]: 0 }))
  }

  const handlePersonaChange = (chatWindowId: string, personaId: string) => {
    setSelectedPersonas(prev => ({ ...prev, [chatWindowId]: personaId }))
    setHasUserChangedPersona(true)
  }

  const getModelName = (chatWindowId: string) => {
    const modelId = selectedModels[chatWindowId]
    const model = allChatModels?.find(m => m?.id === modelId)
    return model?.name || "Select model..."
  }

  const getModelIcon = (chatWindowId: string) => {
    const modelId = selectedModels[chatWindowId]
    const model = allChatModels?.find(m => m?.id === modelId)
    return model ? getProviderIcon(model.id, model.name) : Timer
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && uploadedFiles.length === 0) return

    // Set global loading state - this only affects the submit button
    setIsLoading(true)
    setError(null)
    // Reset retry attempts for new chat
    resetRetryAttempts()

    const newMessage: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, newMessage])
    if (mode !== 'single') setMessages2(prev => [...prev, newMessage])
    if (mode === 'quad') {
      setMessages3(prev => [...prev, newMessage])
      setMessages4(prev => [...prev, newMessage])  
    }
    setInput('')

    // Generate a new multi_conversation_id if in multi-chat mode and none exists
    let currentMultiConversationId = multiConversationId
    if ((mode === 'dual' || mode === 'quad') && !currentMultiConversationId) {
      currentMultiConversationId = crypto.randomUUID()
      setMultiConversationId(currentMultiConversationId)
    }

    // Set streaming states for active windows
    setIsStreaming1(true);
    if (mode !== 'single') setIsStreaming2(true);
    if (mode === 'quad') {
      setIsStreaming3(true);
      setIsStreaming4(true);
    }

    // Set streaming states to false for windows not in use
    if (mode === 'single') {
      streamingStatesRef.current.chat2 = false;
      streamingStatesRef.current.chat3 = false;
      streamingStatesRef.current.chat4 = false;
      setIsStreaming2(false);
      setIsStreaming3(false);
      setIsStreaming4(false);
    } else if (mode === 'dual') {
      streamingStatesRef.current.chat3 = false;
      streamingStatesRef.current.chat4 = false;
      setIsStreaming3(false);
      setIsStreaming4(false);
    }

    // Shared streaming logic
    const makeApiCall = async (
      prevMessagesLocal: Message[],
      setMessagesFunction: React.Dispatch<React.SetStateAction<Message[]>>,
      chatId: string,
      isRetry: boolean = false
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
        // Save scroll position at start of streaming
        const container = chatContainerRefs.current[chatId];
        if (container) {
          const threshold = 100; // pixels from bottom
          const position = container.scrollTop + container.clientHeight;
          const height = container.scrollHeight;
          wasAtBottomBeforeStreamingRef.current[chatId] = height - position <= threshold;
        }
        
        // Set streaming state using both ref and state setter
        streamingStatesRef.current[chatId] = true;
        streamingSetters[chatId](true);

        // Get or create conversation_id for this chat
        let currentConversationId = conversationIds[chatId]
        if (!currentConversationId) {
          currentConversationId = crypto.randomUUID()
          setConversationIds(prev => ({
            ...prev,
            [chatId]: currentConversationId
          }))
        }

        // Get the selected model and persona for this chat
        const modelId = isRetry ? undefined : (selectedModels[chatId] || allChatModels?.[0]?.id)
        const personaId = selectedPersonas[chatId]
        const selectedModel = modelId ? allChatModels?.find(model => model.id === modelId) : undefined
        const selectedPersona = personas?.find(p => p.id.toString() === personaId)

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
            // Mark streaming as complete for this specific chat window
            streamingStatesRef.current[chatId] = false;
            streamingSetters[chatId](false);
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
        // Make sure to mark streaming as complete even if there's an error
        streamingStatesRef.current[chatId] = false;
        streamingSetters[chatId](false);
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
            setError(prevError =>
              prevError
                ? new Error(`${prevError.message}\nRetry failed: ${errMsg}`)
                : new Error(`Retry failed: ${errMsg}`)
            )
          }
        } else {
          const errMsg = err instanceof Error ? err.message : 'Unknown error'
          setError(prevError =>
            prevError
              ? new Error(`${prevError.message}\n${errMsg}`)
              : new Error(errMsg)
          )
        }
      }
    }

    const apiCalls = [
      makeApiCall(messages, setMessages, 'chat1'),
      mode !== 'single' && makeApiCall(messages2, setMessages2, 'chat2'),
      mode === 'quad' && makeApiCall(messages3, setMessages3, 'chat3'),
      mode === 'quad' && makeApiCall(messages4, setMessages4, 'chat4'),
    ].filter(Boolean)

    try {
      // Use Promise.allSettled instead of Promise.all to handle individual failures
      const results = await Promise.allSettled(apiCalls)
      
      // Log any failures for debugging
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const chatId = ['chat1', 'chat2', 'chat3', 'chat4'][index]
          console.error(`Chat ${chatId} failed:`, result.reason)
          
          // Set error message for failed chats
          const errMsg = result.reason instanceof Error ? result.reason.message : 'Unknown error'
          setError(prevError =>
            prevError
              ? new Error(`${prevError.message}\nChat ${chatId}: ${errMsg}`)
              : new Error(`Chat ${chatId}: ${errMsg}`)
          )
        }
      })
    } catch (err: unknown) {
      console.error('Error in handleSubmit:', err)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(prevError =>
        prevError
          ? new Error(`${prevError.message}\n${errMsg}`)
          : new Error(errMsg)
      )
    } finally {
      // Only update the global loading state (affects submit button)
      // The streaming states for each window are handled separately in makeApiCall
      setIsLoading(false)
      setUploadedFiles([])
    }
  }

  // Copy all messages to clipboard
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

  // Add conversation to scratch pad
  const addToScratchPad = async (content: string) => {
    try {
      await addToScratchPadService(content)
    } catch (err) {
      console.error('Failed to add to scratch pad:', err)
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
      setSelectedModels(prev => ({ ...prev, chat1: prompt.default_chat_model_id! }))
    }
    if (!hasUserChangedPersona && prompt.default_persona_id) {
      setSelectedPersonas(prev => ({ ...prev, chat1: prompt.default_persona_id! }))
    }

    // Only set input immediately for simple prompts
    if (!prompt.is_complex) {
      setInput(prompt.prompt)
    } else {
      setSelectedComplexPrompt(prompt)
    }
  }

  // For complex prompts
  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    setInput(generatedPrompt)
    setSelectedComplexPrompt(null)
  }

  // Reset retry attempts when starting a new chat
  const resetRetryAttempts = () => {
    setRetryAttempts({})
  }

  // Add mode change handler
  const handleModeChange = (newMode: 'single' | 'dual' | 'quad') => {
    setMode(newMode)
    
    // Find default and other models
    const defaultModel = allChatModels?.find(model => model.default)
    const otherModels = allChatModels
      ?.filter(model => !model.default && model.id !== defaultModel?.id)
      .slice(0, 3)

    if (defaultModel) {
      // Always keep chat1 as default model
      const newModelSelections: { [key: string]: string } = {
        chat1: defaultModel.id,
      }

      // Add other models based on mode
      if (newMode !== 'single' && otherModels?.[0]) {
        newModelSelections.chat2 = otherModels[0].id
      }
      if (newMode === 'quad') {
        if (otherModels?.[1]) newModelSelections.chat3 = otherModels[1].id
        if (otherModels?.[2]) newModelSelections.chat4 = otherModels[2].id
      }

      setSelectedModels(newModelSelections)
    }

    // Reset retry attempts and multi-conversation tracking
    resetRetryAttempts()
    setMultiConversationId(null)
  }

  // Add toggleChatbot handler
  const handleToggleChatbot = (modelId: string) => {
    // Update the URL
    router.push(`/chat?model=${modelId}`, { scroll: false })
    // Update the selected model
    setSelectedModels(prev => ({
      ...prev,
      chat1: modelId
    }))
  }

  // ChatWindow sub-component
  interface ChatWindowProps {
    messages: Message[]
    messagesEndRef: React.RefObject<HTMLDivElement>
    title: string
    Icon: React.ComponentType<any>
    onCopy: () => void
    onAddToScratchPad: () => void
    onClearConversation: () => void
    isCopied: boolean
    chatWindowId: string
    mode: 'single' | 'dual' | 'quad'
    onContainerRef: (el: HTMLDivElement | null) => void
    isStreamingState: boolean
  }

  const ChatWindow = ({
    messages,
    messagesEndRef,
    title,
    Icon,
    onCopy,
    onAddToScratchPad,
    onClearConversation,
    isCopied,
    chatWindowId,
    mode,
    onContainerRef,
    isStreamingState
  }: ChatWindowProps) => {
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const selectedPersona = personas?.find(p => p.id.toString() === selectedPersonas[chatWindowId]);
    const [localWasAtBottom, setLocalWasAtBottom] = useState(true);

    const handleLocalScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      const container = e.target as HTMLDivElement;
      const threshold = 100; // pixels from bottom
      const position = container.scrollTop + container.clientHeight;
      const height = container.scrollHeight;
      const isAtBottom = height - position <= threshold;
      setLocalWasAtBottom(isAtBottom);
    }, []);

    // Updated auto-scroll effect
    useEffect(() => {
      if (!scrollContainerRef.current) return;
      
      // Only auto-scroll if user was at the bottom
      if (localWasAtBottom) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, [messages, localWasAtBottom]);

    return (
      <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden">
        {/* Top header (title, copy, clear) */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-4">
            {mode === 'single' && (
              <div className="flex items-center gap-2">
                {React.createElement(getModelIcon(chatWindowId), { className: "w-5 h-5" })}
                <span className="font-medium">{getModelName(chatWindowId)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-[200px]">
                <ComboboxPersonas
                  personas={personas || []}
                  value={selectedPersonas[chatWindowId]}
                  onSelect={(persona) => handlePersonaChange(chatWindowId, persona.id.toString())}
                />
              </div>
              <div className="w-[200px]">
                <ComboboxChatModels
                  models={allChatModels || []}
                  value={selectedModels[chatWindowId] || null}
                  onSelect={(model) => handleModelChange(chatWindowId, model.id)}
                />
              </div>
            </div>
          </div>
          {/* Copy, add to scratch pad, clear */}
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onCopy}>
                    {isCopied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isCopied ? "Copied!" : "Copy chat content"}
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
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onClearConversation}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear Conversation</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Chat messages area */}
        <div 
          className="flex-1 p-4 overflow-y-auto scrollable-always"
          style={{ 
            pointerEvents: 'auto', // Force pointer events to be enabled
            touchAction: 'auto',   // Enable touch interactions
            overflowY: 'auto'      // Force scrolling to be enabled 
          }}
          onScroll={handleLocalScroll}
          ref={(el) => {
            if (el) {
              scrollContainerRef.current = el;
              chatContainerRefs.current[chatWindowId] = el;
              onContainerRef(el);
            }
          }}
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
          {isStreamingState && (
            <div className="sticky bottom-4 w-full flex justify-center pointer-events-none z-10">
              <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating response...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const loadAssets = useCallback(async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) return;
      const assets = await fetchAssets(headers);
      setAssets(assets);
    } catch (error) {
      console.error('Error loading assets:', error);
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
            <div className="grid h-full gap-4" style={{ gridTemplateColumns: '1fr', isolation: 'isolate' }}>
              <ChatWindow
                messages={messages}
                messagesEndRef={messagesEndRef}
                title="Perplexity Llama"
                Icon={Timer}
                onCopy={() => copyToClipboard(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                onAddToScratchPad={() => addToScratchPad(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                onClearConversation={() => clearConversation(messages)}
                isCopied={copiedStates[messages.map(m => `${m.role}: ${m.content}`).join('\n')]}
                chatWindowId="chat1"
                mode={mode}
                onContainerRef={(el) => {
                  chatContainerRefs.current.chat1 = el;
                  // For backwards compatibility with single mode
                  if (el && chatContainerRef.current !== el) {
                    // Use Object.assign to modify the ref without triggering the readonly error
                    Object.assign(chatContainerRef, { current: el });
                  }
                }}
                isStreamingState={isStreaming1}
              />
            </div>
          ) : (
            <div
              className="grid h-full gap-4"
              style={{
                gridTemplateColumns: mode === 'dual' ? '1fr 1fr' : '1fr 1fr',
                gridTemplateRows: mode === 'quad' ? '1fr 1fr' : '1fr',
                isolation: 'isolate' // Ensures each grid item has its own stacking context
              }}
            >
              <ChatWindow
                messages={messages}
                messagesEndRef={messagesEndRef}
                title="Perplexity Llama"
                Icon={Timer}
                onCopy={() => copyToClipboard(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                onAddToScratchPad={() => addToScratchPad(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                onClearConversation={() => clearConversation(messages)}
                isCopied={copiedStates[messages.map(m => `${m.role}: ${m.content}`).join('\n')]}
                chatWindowId="chat1"
                mode={mode}
                onContainerRef={(el) => chatContainerRefs.current.chat1 = el}
                isStreamingState={isStreaming1}
              />
              <ChatWindow
                messages={messages2}
                messagesEndRef={messagesEndRef2}
                title="GPT-4o"
                Icon={Sparkles}
                onCopy={() => copyToClipboard(messages2.map(m => `${m.role}: ${m.content}`).join('\n'))}
                onAddToScratchPad={() => addToScratchPad(messages2.map(m => `${m.role}: ${m.content}`).join('\n'))}
                onClearConversation={() => clearConversation(messages2)}
                isCopied={copiedStates[messages2.map(m => `${m.role}: ${m.content}`).join('\n')]}
                chatWindowId="chat2"
                mode={mode}
                onContainerRef={(el) => chatContainerRefs.current.chat2 = el}
                isStreamingState={isStreaming2}
              />
              {mode === 'quad' && (
                <>
                  <ChatWindow
                    messages={messages3}
                    messagesEndRef={messagesEndRef3}
                    title="Gemini 1.5 Pro"
                    Icon={Bot}
                    onCopy={() => copyToClipboard(messages3.map(m => `${m.role}: ${m.content}`).join('\n'))}
                    onAddToScratchPad={() => addToScratchPad(messages3.map(m => `${m.role}: ${m.content}`).join('\n'))}
                    onClearConversation={() => clearConversation(messages3)}
                    isCopied={copiedStates[messages3.map(m => `${m.role}: ${m.content}`).join('\n')]}
                    chatWindowId="chat3"
                    mode={mode}
                    onContainerRef={(el) => chatContainerRefs.current.chat3 = el}
                    isStreamingState={isStreaming3}
                  />
                  <ChatWindow
                    messages={messages4}
                    messagesEndRef={messagesEndRef4}
                    title="Meta Llama 3.1"
                    Icon={SmilePlus}
                    onCopy={() => copyToClipboard(messages4.map(m => `${m.role}: ${m.content}`).join('\n'))}
                    onAddToScratchPad={() => addToScratchPad(messages4.map(m => `${m.role}: ${m.content}`).join('\n'))}
                    onClearConversation={() => clearConversation(messages4)}
                    isCopied={copiedStates[messages4.map(m => `${m.role}: ${m.content}`).join('\n')]}
                    chatWindowId="chat4"
                    mode={mode}
                    onContainerRef={(el) => chatContainerRefs.current.chat4 = el}
                    isStreamingState={isStreaming4}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer (input / mode toggle) */}
        <div className="border-t p-4 flex items-center gap-2">
          <PromptSelector prompts={prompts} categories={categories} onSelectPrompt={handlePromptSelect}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select Prompt</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </PromptSelector>

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