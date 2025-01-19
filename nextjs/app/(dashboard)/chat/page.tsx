'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Copy, Trash2, Send, BookOpen, Grid2X2, Columns, Square, MessageSquare,
  Loader2, Timer, Bot, Sparkles, SmilePlus, Check, FileText, Paperclip, X, Database, ChevronDown
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
import { fetchManagedAssets } from '@/utils/asset-service'
import { Asset } from '@/types/knowledge-base'

// Import required Uppy CSS
import '@uppy/core/dist/style.min.css'
import '@uppy/dashboard/dist/style.min.css'

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chat() {
  const { sidebarOpen } = useSidebar()
  const { promptTemplates: prompts, categories, chatModels, personas } = useData()
  const { session, getApiHeaders } = useSession()
  const supabase = useSupabase()

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
  const [selectedPersonas, setSelectedPersonas] = useState<{ [key: string]: string }>({
    chat1: 'default',
    chat2: 'default',
    chat3: 'default',
    chat4: 'default'
  })
  const [conversationIds, setConversationIds] = useState<{ [key: string]: string }>({})
  const [multiConversationId, setMultiConversationId] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(true)

  const uppyRef = useRef<Uppy | null>(null)

  useEffect(() => {
    if (!uppyRef.current) {
      uppyRef.current = UploadService.createUppy(
        'uppy-chatsse',
        {},
        (file) => {
          console.log('File uploaded:', file)
          setUploadedFiles(prev => [...prev, file])
        },
        () => {
          setShowUploadModal(false)
        },
        supabase
      )
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
  }

  const handlePersonaChange = (chatWindowId: string, personaId: string) => {
    setSelectedPersonas(prev => ({ ...prev, [chatWindowId]: personaId }))
  }

  const getModelName = (chatWindowId: string) => {
    const modelId = selectedModels[chatWindowId]
    const model = chatModels?.find(m => m.id.toString() === modelId)
    return model?.name || "Default Model"
  }

  const getModelIcon = (chatWindowId: string) => {
    const modelId = selectedModels[chatWindowId]
    const model = chatModels?.find(m => m.id.toString() === modelId)
    return model ? getProviderIcon(model.id.toString(), model.name) : Timer
  }

  const handleFileUpload = () => {
    setShowUploadModal(true)
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

    setIsLoading(true)
    setError(null)

    const newMessage: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, newMessage])
    setMessages2(prev => [...prev, newMessage])
    setMessages3(prev => [...prev, newMessage])
    setMessages4(prev => [...prev, newMessage])
    setInput('')

    // Generate a new multi_conversation_id if in multi-chat mode and none exists
    let currentMultiConversationId = multiConversationId
    if ((mode === 'dual' || mode === 'quad') && !currentMultiConversationId) {
      currentMultiConversationId = crypto.randomUUID()
      setMultiConversationId(currentMultiConversationId)
    }

    // Shared streaming logic
    const makeApiCall = async (
      prevMessagesLocal: Message[],
      setMessagesFunction: React.Dispatch<React.SetStateAction<Message[]>>,
      chatId: string
    ) => {
      try {
        isStreamingRef.current = true;
        // Get or create conversation_id for this chat window
        let currentConversationId = conversationIds[chatId]
        if (!currentConversationId) {
          currentConversationId = crypto.randomUUID()
          setConversationIds(prev => ({
            ...prev,
            [chatId]: currentConversationId
          }))
        }

        // Get the selected model and persona for this chat
        const modelId = selectedModels[chatId]
        const personaId = selectedPersonas[chatId]
        const selectedModel = chatModels?.find(model => model.id.toString() === modelId)
        const selectedPersona = personas?.find(p => p.id.toString() === personaId)

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
            files: uploadedFiles.map(f => ({ name: f.name, url: f.url })),
            conversation_id: currentConversationId,
            knowledge_base_ids: selectedKnowledgeBases.map(kb => kb.id),
            asset_ids: selectedAssets.map(asset => asset.id),
            ...(currentMultiConversationId && { multi_conversation_id: currentMultiConversationId })
          }),
        })

        if (!response.ok || !response.body) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        let assistantMessage = ''
        setMessagesFunction(prev => [
          ...prev,
          { role: 'assistant', content: '' },
        ])

        while (true) {
          const { value, done } = await reader.read()
          if (done) {
            isStreamingRef.current = false;
            // After streaming is complete, ensure content is scrollable
            if (chatContainerRef.current) {
              chatContainerRef.current.style.overflowY = 'auto';
            }
            break
          }
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonData = line.slice(5).trim()
              if (jsonData !== '[DONE]') {
                try {
                  const parsed = JSON.parse(jsonData)
                  if (parsed.choices && parsed.choices[0].delta.content) {
                    assistantMessage += parsed.choices[0].delta.content
                    setMessagesFunction(prev => {
                      const updated = [...prev]
                      updated[updated.length - 1] = {
                        role: 'assistant',
                        content: assistantMessage,
                      }
                      // Ensure content is scrollable during streaming
                      if (chatContainerRef.current) {
                        chatContainerRef.current.style.overflowY = 'auto';
                      }
                      return updated
                    })
                  }
                } catch (parseError) {
                  console.error('Error parsing chunk line:', parseError, line)
                }
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
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        setError(prevError =>
          prevError
            ? new Error(`${prevError.message}\n${errMsg}`)
            : new Error(errMsg)
        )
      }
    }

    const apiCalls = [
      makeApiCall(messages, setMessages, 'chat1'),
      mode !== 'single' && makeApiCall(messages2, setMessages2, 'chat2'),
      mode === 'quad' && makeApiCall(messages3, setMessages3, 'chat3'),
      mode === 'quad' && makeApiCall(messages4, setMessages4, 'chat4'),
    ].filter(Boolean)

    try {
      await Promise.all(apiCalls)
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
    if (prompt.is_complex) {
      setSelectedComplexPrompt(prompt)
    } else {
      setInput(prevInput => {
        const prefix = prevInput ? prevInput + ' ' : ''
        const promptText = typeof prompt.prompt === 'string' ? prompt.prompt : ''
        return prefix + promptText
      })
    }
  }

  // For complex prompts
  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    setInput(prevInput => (prevInput ? prevInput + ' ' : '') + generatedPrompt)
    setSelectedComplexPrompt(null)
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
    chatWindowId
  }: ChatWindowProps) => {
    const isStreaming = isStreamingRef.current;
    
    return (
      <TooltipProvider>
        <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden">
          {/* Top header (title, copy, clear) */}
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {React.createElement(getModelIcon(chatWindowId), { className: "w-5 h-5" })}
                <span className="font-medium">{getModelName(chatWindowId)}</span>
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
                    {chatModels?.map((model) => (
                      <SelectItem key={model.id} value={model.id.toString()}>
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

          {/* Chat messages area */}
          <ScrollArea 
            className="flex-1 p-4 relative" 
            onScroll={handleScroll}
            ref={chatContainerRef}
          >
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
                >
                  <div
                    className={`inline-block p-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-black'
                    }`}
                  >
                    {isMarkdown(message.content) ? (
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </div>
            {isStreaming && (
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

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* LEFT COLUMN (sidebar) */}
      <div className="w-64 h-full border-r border-gray-200">
        <AppSidebar toggleChatbot={() => {}} />
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
                onCopy={() => copyToClipboard(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
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
                onCopy={() => copyToClipboard(messages.map(m => `${m.role}: ${m.content}`).join('\n'))}
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
                onCopy={() => copyToClipboard(messages2.map(m => `${m.role}: ${m.content}`).join('\n'))}
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
                    onCopy={() => copyToClipboard(messages3.map(m => `${m.role}: ${m.content}`).join('\n'))}
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
                    onCopy={() => copyToClipboard(messages4.map(m => `${m.role}: ${m.content}`).join('\n'))}
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
          <PromptSelector prompts={prompts} categories={categories} onSelectPrompt={handlePromptSelect}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <BookOpen className="h-4 w-4" />
            </Button>
          </PromptSelector>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowUploadModal(true)}>
            <Paperclip className="h-4 w-4" />
          </Button>

          <KnowledgeBaseSelector
            knowledgeBases={knowledgeBases}
            isLoadingKnowledgeBases={isLoadingKnowledgeBases}
            selectedKnowledgeBases={selectedKnowledgeBases}
            selectedAssets={selectedAssets}
            onSelectKnowledgeBase={(kb) => setSelectedKnowledgeBases(prev => [...prev, kb])}
            onDeselectKnowledgeBase={(kb) => setSelectedKnowledgeBases(prev => prev.filter(item => item.id !== kb.id))}
            onSelectAsset={(asset) => setSelectedAssets(prev => [...prev, asset])}
            onDeselectAsset={(asset) => setSelectedAssets(prev => prev.filter(item => item.id !== asset.id))}
          />

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