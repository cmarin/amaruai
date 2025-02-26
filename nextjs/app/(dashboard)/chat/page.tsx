'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Copy, Trash2, Send, BookOpen, Grid2X2, Columns, Square, MessageSquare,
  Loader2, Timer, Bot, Sparkles, SmilePlus, Check, FileText, Paperclip, X, Globe2
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

// Add import for chat service
import { prepareChatSubmission, handleChatSubmission } from '@/utils/chat-service';

// Add a style to force scrolling to be enabled at all times
const ChatScrollStyles = () => (
  <style jsx global>{`
    /* Force scrolling to be enabled at all times */
    [data-chat-id] > div[data-scroll-container] {
      overflow-y: auto !important;
      height: 100% !important;
      position: relative !important;
      z-index: 1 !important;
      pointer-events: auto !important;
    }
    
    /* Ensure all parent elements allow scrolling */
    [data-chat-id] * {
      overflow: visible !important;
    }
    
    /* Ensure the chat container itself is scrollable */
    .flex-1.p-4.relative.overflow-y-auto {
      overflow-y: auto !important;
      pointer-events: auto !important;
    }
    
    /* Ensure the chat message content is visible */
    .space-y-4 {
      overflow: visible !important;
    }
  `}</style>
);

// Component to ensure scrolling is always enabled
const ScrollEnabler = () => {
  useEffect(() => {
    // Function to ensure scrolling is enabled
    const enableScrolling = () => {
      const chatWindows = document.querySelectorAll('[data-chat-id]');
      chatWindows.forEach(chatWindow => {
        const chatId = chatWindow.getAttribute('data-chat-id');
        const scrollContainer = chatWindow.querySelector(`div[data-scroll-container="${chatId}"]`);
        
        if (scrollContainer) {
          (scrollContainer as HTMLElement).style.overflowY = 'auto';
          (scrollContainer as HTMLElement).style.pointerEvents = 'auto';
        }
      });
    };
    
    // Run immediately
    enableScrolling();
    
    // Set up a MutationObserver to ensure scrolling stays enabled
    const observer = new MutationObserver(() => {
      enableScrolling();
    });
    
    // Observe the entire document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Clean up
    return () => {
      observer.disconnect();
    };
  }, []);
  
  return null;
};

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef2 = useRef<HTMLDivElement>(null);
  const messagesEndRef3 = useRef<HTMLDivElement>(null);
  const messagesEndRef4 = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRefs = useRef<{[key: string]: HTMLDivElement | null}>({
    chat1: null,
    chat2: null,
    chat3: null,
    chat4: null
  });
  // Use individual streaming refs for each chat window
  const isStreamingRef = useRef<boolean>(false);
  const isStreamingRefs = useRef<{[key: string]: boolean}>({
    chat1: false,
    chat2: false,
    chat3: false,
    chat4: false
  });
  const wasAtBottomRef = useRef<boolean>(true);

  // Track user scroll state for each chat window
  const userScrollStateRef = useRef<{[key: string]: boolean}>({
    chat1: false,
    chat2: false,
    chat3: false,
    chat4: false
  });

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>, chatWindowId: string) => {
    const container = e.target as HTMLDivElement;
    const atBottom = isAtBottom(container);
    
    // If we're at the bottom, reset the user scroll state
    if (atBottom) {
      userScrollStateRef.current[chatWindowId] = false;
      container.setAttribute('data-user-scrolled', 'false');
    } else {
      // If we're not at the bottom and the user is actively scrolling, mark as user-scrolled
      userScrollStateRef.current[chatWindowId] = true;
      container.setAttribute('data-user-scrolled', 'true');
    }
    
    // For global tracking
    wasAtBottomRef.current = atBottom;
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

    try {
      // Use the handleChatSubmission function from chat-service.ts
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
        chatContainerRefs,
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
        isStreamingRefs,
        userScrollStateRef
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
    handleToggleChatbotUtil(modelId, router, setSelectedModels);
  }

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
    // Use individual streaming state for each chat window
    const isStreaming = isStreamingRefs.current[chatWindowId] || isStreamingRef.current;
    const selectedPersona = personas?.find(p => p.id.toString() === selectedPersonas[chatWindowId]);
    
    return (
      <TooltipProvider>
        <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden" data-chat-id={chatWindowId}>
          {/* Top header (title, copy, clear) */}
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {React.createElement(getModelIcon(chatWindowId, selectedModels, allChatModels), { className: "w-5 h-5" })}
                <span className="font-medium">{getModelName(chatWindowId, selectedModels, allChatModels)}</span>
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
          </div>

          {/* Chat messages area - Using an iframe to ensure scrolling works independently */}
          <div 
            className="flex-1 relative"
            style={{ height: '100%' }}
          >
            <iframe
              className="w-full h-full border-0"
              ref={(el) => { 
                if (el) {
                  chatContainerRefs.current[chatWindowId] = el.contentDocument?.body as any;
                  
                  // Initialize the iframe content
                  if (el.contentDocument) {
                    // Add styles to the iframe
                    const style = el.contentDocument.createElement('style');
                    style.textContent = `
                      body {
                        margin: 0;
                        padding: 16px;
                        font-family: sans-serif;
                        overflow-y: auto;
                        height: 100%;
                        background-color: white;
                      }
                      .message-container {
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                      }
                      .message {
                        padding: 12px;
                        border-radius: 8px;
                        max-width: 80%;
                      }
                      .user {
                        align-self: flex-end;
                        background-color: #f0f0f0;
                      }
                      .assistant {
                        align-self: flex-start;
                        background-color: #e6f7ff;
                      }
                      .loading {
                        position: sticky;
                        bottom: 16px;
                        width: 100%;
                        display: flex;
                        justify-content: center;
                      }
                      .loading-indicator {
                        background-color: rgba(255, 255, 255, 0.8);
                        backdrop-filter: blur(4px);
                        border-radius: 9999px;
                        padding: 8px 16px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 14px;
                        color: #666;
                      }
                      @keyframes spin {
                        to { transform: rotate(360deg); }
                      }
                      .spinner {
                        width: 16px;
                        height: 16px;
                        border: 2px solid #ccc;
                        border-top-color: #666;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                      }
                    `;
                    el.contentDocument.head.appendChild(style);
                    
                    // Create container for messages
                    const container = el.contentDocument.createElement('div');
                    container.className = 'message-container';
                    el.contentDocument.body.appendChild(container);
                    
                    // Add scroll event listener
                    el.contentDocument.addEventListener('scroll', (e) => {
                      const doc = el.contentDocument;
                      if (doc) {
                        const atBottom = (doc.body.scrollHeight - doc.body.scrollTop - doc.body.clientHeight) < 100;
                        userScrollStateRef.current[chatWindowId] = !atBottom;
                      }
                    });
                  }
                }
              }}
              srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>`}
              onLoad={(e) => {
                const iframe = e.currentTarget;
                const doc = iframe.contentDocument;
                if (!doc) return;
                
                // Clear existing content
                const container = doc.querySelector('.message-container');
                if (container) {
                  container.innerHTML = '';
                  
                  // Add messages
                  messages.forEach(message => {
                    const messageEl = doc.createElement('div');
                    messageEl.className = `message ${message.role}`;
                    messageEl.textContent = message.content;
                    container.appendChild(messageEl);
                  });
                  
                  // Add loading indicator if streaming
                  if (isStreaming) {
                    const loadingEl = doc.createElement('div');
                    loadingEl.className = 'loading';
                    loadingEl.innerHTML = `
                      <div class="loading-indicator">
                        <div class="spinner"></div>
                        <span>Generating response...</span>
                      </div>
                    `;
                    container.appendChild(loadingEl);
                  }
                  
                  // Scroll to bottom if not user scrolled
                  if (!userScrollStateRef.current[chatWindowId]) {
                    doc.body.scrollTop = doc.body.scrollHeight;
                  }
                }
              }}
            />
          </div>
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

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ChatScrollStyles />
      <ScrollEnabler />
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
