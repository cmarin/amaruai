'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Copy, Trash2, Send, BookOpen, Grid2X2, Columns, Square, MessageSquare,
  Loader2, Timer, Bot, Sparkles, SmilePlus, Check, FileText, Paperclip, X, Globe2, Database
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

// Import the types and utilities
import { Message, ChatMode, ChatWindowProps } from '@/types/chat'
import { PromptTemplate } from '@/utils/prompt-template-service'
import { 
  isAtBottom, 
  maintainScroll, 
  getProviderIcon, 
  getModelIcon, 
  getModelName, 
  copyToClipboard as copyToClipboardUtil,
  resetSelectedModels,
  makeApiCall,
  addToScratchPad as addToScratchPadUtil,
  handlePromptSelect as handlePromptSelectUtil,
  handleComplexPromptSubmit as handleComplexPromptSubmitUtil,
  handleModeChange as handleModeChangeUtil,
  handleToggleChatbot as handleToggleChatbotUtil
} from '@/utils/chat-utils'

// Import the chat upload utilities
import {
  initializeChatUploader,
  handleFileUpload as handleChatFileUpload,
  closeUploadModal,
  removeUploadedFile
} from '@/utils/chat-uploads'

// Import required Uppy CSS
import '@uppy/core/dist/style.min.css'
import '@uppy/dashboard/dist/style.min.css'

// Import chat service
import { prepareChatSubmission, handleChatSubmission } from '@/utils/chat-service';

function ChatContent() {
  const { sidebarOpen } = useSidebar()
  const { promptTemplates: prompts, setData, categories, chatModels: allChatModels, personas } = useData()
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
  const [mode, setMode] = useState<ChatMode>('single')
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [selectedComplexPrompt, setSelectedComplexPrompt] = useState<any | null>(null)
  const [selectedModels, setSelectedModels] = useState<{ [key: string]: string }>({})
  const [selectedPersonas, setSelectedPersonas] = useState<{ [key: string]: string }>({
    chat1: 'default',
    chat2: 'default',
    chat3: 'default',
    chat4: 'default'
  })

  useEffect(() => {
    console.log('Personas changed:', personas);
  }, [personas]);

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef2 = useRef<HTMLDivElement>(null);
  const messagesEndRef3 = useRef<HTMLDivElement>(null);
  const messagesEndRef4 = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef<boolean>(false);
  const activeStreamsRef = useRef<Set<string>>(new Set());
  const wasAtBottomRef = useRef<boolean>(true);

  useEffect(() => {
    // Use the utility function to initialize uploader
    const cleanupUploader = initializeChatUploader(
      uppyRef,
      (file) => {
        setUploadedFiles(prev => [...prev, file]);
      },
      () => {
        setShowUploadModal(false);
      },
      supabase
    );
    
    // Return the cleanup function
    return cleanupUploader;
  }, [supabase]);

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
      console.log('Available chat models:', allChatModels.map(m => ({
        id: m.id,
        name: m.name,
        position: m.position,
        provider: m.provider
      })));
      
      // Sort models by position to show them in the console
      const sortedByPosition = [...allChatModels].sort((a, b) => {
        if (a.position !== undefined && a.position !== null && b.position !== undefined && b.position !== null) {
          return a.position - b.position;
        }
        if (a.position !== undefined && a.position !== null) return -1;
        if (b.position !== undefined && b.position !== null) return 1;
        return 0;
      });
      
      console.log('Models sorted by position:', sortedByPosition.map(m => ({
        id: m.id,
        name: m.name,
        position: m.position,
        provider: m.provider
      })));
      
      setSelectedModels(resetSelectedModels(mode, allChatModels));
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

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.target as HTMLDivElement;
    wasAtBottomRef.current = isAtBottom(container);
  }, []);

  const handleModelChange = (chatWindowId: string, modelId: string) => {
    setSelectedModels(prev => ({ ...prev, [chatWindowId]: modelId }))
    // Reset retry attempts when manually changing model
    setRetryAttempts(prev => ({ ...prev, [chatWindowId]: 0 }))
  }

  const handlePersonaChange = (chatWindowId: string, personaId: string) => {
    setSelectedPersonas(prev => ({ ...prev, [chatWindowId]: personaId }))
  }

  const handleFileUpload = async (result: any) => {
    handleChatFileUpload(result, setUploadedFiles);
  }

  const handleCloseUploadModal = () => {
    closeUploadModal(uppyRef, setShowUploadModal);
  }

  const handleRemoveFile = (file: UploadedFile) => {
    removeUploadedFile(file, setUploadedFiles);
  }

  // Submit user input to all relevant LLMs
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && uploadedFiles.length === 0) return

    setIsLoading(true)
    setError(null)
    // Reset retry attempts for new chat
    resetRetryAttempts()
    
    // Reset active streams tracking
    activeStreamsRef.current.clear();

    try {
      // Use the modified chat-service to pass the mode and activeStreamsRef
      await handleChatSubmission({
        input,
        uploadedFiles,
        mode,
        conversationIds,
        multiConversationId,
        selectedModels,
        selectedPersonas,
        selectedKnowledgeBases,
        selectedAssets,
        isWebSearchEnabled,
        allChatModels,
        session,
        getApiHeaders,
        retryAttempts,
        setRetryAttempts,
        setError,
        isStreamingRef,
        chatContainerRef,
        personas,
        messages,
        messages2,
        messages3,
        messages4,
        setMessages,
        setMessages2,
        setMessages3,
        setMessages4,
        setConversationIds,
        setMultiConversationId,
        activeStreamsRef
      });
      
      // Clear input field after submission
      setInput('');
    } catch (err: unknown) {
      console.error('Error in handleSubmit:', err)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(prevError =>
        prevError
          ? new Error(`${prevError.message}\n${errMsg}`)
          : new Error(errMsg)
      )
    } finally {
      setIsLoading(false)
      setUploadedFiles([])
    }
  }

  // Copy text to clipboard
  const handleCopyToClipboard = async (content: string) => {
    await copyToClipboardUtil(content, setCopiedStates);
  }

  // Add conversation to scratch pad
  const addToScratchPad = async (content: string) => {
    await addToScratchPadUtil(content);
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
    // Apply default persona and model if they exist in the prompt template
    if (prompt.default_persona_id) {
      handlePersonaChange('chat1', prompt.default_persona_id);
    }
    
    if (prompt.default_chat_model_id) {
      handleModelChange('chat1', prompt.default_chat_model_id);
    }
    
    // Then handle the prompt text as before
    handlePromptSelectUtil(prompt, setSelectedComplexPrompt, setInput);
  }

  // For complex prompts
  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    handleComplexPromptSubmitUtil(generatedPrompt, setInput, setSelectedComplexPrompt);
  }

  // Reset retry attempts when starting a new chat
  const resetRetryAttempts = () => {
    setRetryAttempts({})
  }

  // Add mode change handler
  const handleModeChange = (newMode: ChatMode) => {
    handleModeChangeUtil(
      newMode,
      setMode,
      allChatModels,
      setSelectedModels,
      resetRetryAttempts,
      setMultiConversationId
    );
  }

  // Add toggleChatbot handler
  const handleToggleChatbot = (modelId: string) => {
    handleToggleChatbotUtil(modelId, router, setSelectedModels, allChatModels);
  }

  // Function to ensure the close button is visible
  const ensureCloseButtonVisible = useCallback(() => {
    setTimeout(() => {
      const closeButtons = document.querySelectorAll('.uppy-Dashboard-close');
      closeButtons.forEach(button => {
        if (button instanceof HTMLElement) {
          button.style.opacity = '1';
          button.style.visibility = 'visible';
          button.style.display = 'flex';
        }
      });
    }, 300);
  }, []);

  // Add an effect to ensure the close button is visible whenever the upload modal is opened
  useEffect(() => {
    if (showUploadModal) {
      ensureCloseButtonVisible();
    }
  }, [showUploadModal, ensureCloseButtonVisible]);

  // ChatWindow sub-component
  const ChatWindow = ({
    messages,
    messagesEndRef,
    title,
    Icon,
    onCopy,
    onAddToScratchPad,
    onClearConversation,
    isCopied,
    chatWindowId
  }: ChatWindowProps) => {
    const isStreaming = isStreamingRef.current;
    const selectedPersona = personas?.find(p => p.id.toString() === selectedPersonas[chatWindowId]);
    
    return (
      <TooltipProvider>
        <div className="flex flex-col h-full border rounded-lg bg-white dark:bg-background dark:border-gray-700 overflow-hidden">
          {/* Top header (title, copy, clear) */}
          <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {React.createElement(getModelIcon(chatWindowId, selectedModels, allChatModels), { className: "w-5 h-5" })}
                <span className="font-medium dark:text-white">{getModelName(chatWindowId, selectedModels, allChatModels)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedPersonas[chatWindowId]} onValueChange={(value) => handlePersonaChange(chatWindowId, value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    {personas?.map((persona) => (
                      <SelectItem key={persona.id} value={persona.id.toString()}>
                        {persona.role || "Default"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedModels[chatWindowId]} onValueChange={(value) => handleModelChange(chatWindowId, value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={title} />
                  </SelectTrigger>
                  <SelectContent>
                    {allChatModels?.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
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
                    {isCopied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 border dark:border-gray-700">
                  {isCopied ? "Copied!" : "Copy chat content"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onAddToScratchPad}>
                    <FileText className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 border dark:border-gray-700">Add to Scratch Pad</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onClearConversation}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 border dark:border-gray-700">Clear Conversation</TooltipContent>
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
            {isStreaming && (
              <div className="sticky bottom-4 w-full flex justify-center">
                <div className="bg-white/80 dark:bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-muted-foreground">
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

  // Function to handle loading more prompts
  const handleLoadMorePrompts = useCallback((newPrompts: PromptTemplate[], offset?: number) => {
    if (!newPrompts || newPrompts.length === 0) {
      console.log('No new prompts to add');
      return;
    }

    // Prevent duplicate state updates if we're already updating
    if (isLoading) {
      console.log('Already loading, skipping state update');
      return;
    }

    console.log(`Adding ${newPrompts.length} new prompts to existing ${prompts.length} prompts`);
    
    // Add new prompts to the existing ones, avoiding duplicates
    const existingIds = new Set(prompts.map(p => p.id));
    const uniqueNewPrompts = newPrompts.filter(newPrompt => !existingIds.has(newPrompt.id));
    
    if (uniqueNewPrompts.length === 0) {
      console.log('All new prompts are duplicates, not updating state');
      return;
    }
    
    console.log(`Adding ${uniqueNewPrompts.length} unique new prompts`);
    
    // Separate existing prompts into favorites and others
    const existingFavorites = prompts.filter(p => p.is_favorite);
    const existingNonFavorites = prompts.filter(p => !p.is_favorite);
    
    // Merge in the new prompts with existing non-favorites
    const combined = [...existingFavorites, ...existingNonFavorites, ...uniqueNewPrompts];
    
    console.log(`New total: ${combined.length} prompts (${existingFavorites.length} favorites + ${existingNonFavorites.length + uniqueNewPrompts.length} others)`);
    
    setData({
      promptTemplates: combined
    });
  }, [prompts, setData, isLoading]);

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white dark:bg-background">
        <AppSidebar toggleChatbot={handleToggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          {/* Body/Chat section (scrollable) */}
          <div className="flex-1 overflow-auto p-4">
            {/* Single/dual/quad chat windows */}
            {mode === 'single' ? (
              <div className="grid h-full gap-4" style={{ gridTemplateColumns: '1fr' }}>
                <ChatWindow
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                  title="Perplexity Llama"
                  Icon={Timer}
                  onCopy={() => handleCopyToClipboard(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                  onAddToScratchPad={() => addToScratchPad(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                  onClearConversation={() => clearConversation(messages)}
                  isCopied={copiedStates[messages.map(m => `${m.role}: ${m.content}`).join('\n')]}
                  chatWindowId="chat1"
                />
              </div>
            ) : (
              <div
                className="grid h-full gap-4"
                style={{
                  gridTemplateColumns: mode === 'dual' ? '1fr 1fr' : '1fr 1fr',
                  gridTemplateRows: mode === 'quad' ? '1fr 1fr' : '1fr',
                }}
              >
                <ChatWindow
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                  title="Perplexity Llama"
                  Icon={Timer}
                  onCopy={() => handleCopyToClipboard(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                  onAddToScratchPad={() => addToScratchPad(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
                  onClearConversation={() => clearConversation(messages)}
                  isCopied={copiedStates[messages.map(m => `${m.role}: ${m.content}`).join('\n')]}
                  chatWindowId="chat1"
                />
                <ChatWindow
                  messages={messages2}
                  messagesEndRef={messagesEndRef2}
                  title="GPT-4o"
                  Icon={Sparkles}
                  onCopy={() => handleCopyToClipboard(messages2.map(m => `${m.role}: ${m.content}`).join('\n'))}
                  onAddToScratchPad={() => addToScratchPad(messages2.map(m => `${m.role}: ${m.content}`).join('\n'))}
                  onClearConversation={() => clearConversation(messages2)}
                  isCopied={copiedStates[messages2.map(m => `${m.role}: ${m.content}`).join('\n')]}
                  chatWindowId="chat2"
                />
                {mode === 'quad' && (
                  <>
                    <ChatWindow
                      messages={messages3}
                      messagesEndRef={messagesEndRef3}
                      title="Gemini 1.5 Pro"
                      Icon={Bot}
                      onCopy={() => handleCopyToClipboard(messages3.map(m => `${m.role}: ${m.content}`).join('\n'))}
                      onAddToScratchPad={() => addToScratchPad(messages3.map(m => `${m.role}: ${m.content}`).join('\n'))}
                      onClearConversation={() => clearConversation(messages3)}
                      isCopied={copiedStates[messages3.map(m => `${m.role}: ${m.content}`).join('\n')]}
                      chatWindowId="chat3"
                    />
                    <ChatWindow
                      messages={messages4}
                      messagesEndRef={messagesEndRef4}
                      title="Meta Llama 3.1"
                      Icon={SmilePlus}
                      onCopy={() => handleCopyToClipboard(messages4.map(m => `${m.role}: ${m.content}`).join('\n'))}
                      onAddToScratchPad={() => addToScratchPad(messages4.map(m => `${m.role}: ${m.content}`).join('\n'))}
                      onClearConversation={() => clearConversation(messages4)}
                      isCopied={copiedStates[messages4.map(m => `${m.role}: ${m.content}`).join('\n')]}
                      chatWindowId="chat4"
                    />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer (input / mode toggle) */}
          <div className="border-t p-4">
            {/* File upload pills */}
            {uploadedFiles.length > 0 && (
              <div className="mb-3">
                <FileUploadPills files={uploadedFiles} onRemove={handleRemoveFile} />
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative z-[60]">
                      <PromptSelector 
                        prompts={prompts} 
                        categories={categories} 
                        onSelectPrompt={handlePromptSelect}
                        onLoad={handleLoadMorePrompts}
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <BookOpen className="h-4 w-4" />
                        </Button>
                      </PromptSelector>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} className="bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 border dark:border-gray-700 z-[70]">
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
                  <TooltipContent className="bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 border dark:border-gray-700">
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
                  <TooltipContent className="bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 border dark:border-gray-700">
                    <p>Knowledge Base</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild data-kb-selector="true">
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
                  </TooltipTrigger>
                  <TooltipContent className="bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 border dark:border-gray-700">
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
                    <TooltipContent className="bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 border dark:border-gray-700">
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
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg max-w-2xl w-full relative">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold dark:text-white">Upload Files</h2>
                  <Button variant="ghost" size="icon" onClick={handleCloseUploadModal} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="uppy-wrapper">
                  <Dashboard 
                    uppy={uppyRef.current} 
                    plugins={[]} 
                    showLinkToFileUploadResult={false}
                    proudlyDisplayPoweredByUppy={false}
                    hideUploadButton={false}
                    height={400}
                    width="100%"
                    doneButtonHandler={() => handleCloseUploadModal()}
                    showProgressDetails={true}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
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