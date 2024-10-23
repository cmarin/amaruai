'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageSquare, FileText, Brain, ChevronDown, LayoutGrid, Columns, Square, BookOpen, Copy, Check, ChevronLeft, ChevronRight, Eraser, Trash2, Paperclip, X, File, Star, Workflow } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PromptSelector } from '@/components/prompt-selector'
import PromptLibrary from '@/components/prompt-library'
import { ComplexPromptModal } from '@/components/complex-prompt-modal'
import PersonaLibrary from '@/components/persona-library'
import { PromptTemplate, fetchPromptTemplates } from '@/components/promptTemplateService'
import ReactMarkdown from 'react-markdown'
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';
import { v4 as uuidv4 } from 'uuid';
import { fetchPersonas, Persona } from '@/components/personaService'
import { Category, fetchCategories } from '@/components/categoryService'
import { ChatModel, fetchChatModels } from '@/components/chatModelService'
import { fetchWithRetry } from '@/components/apiUtils'
import { useData } from '@/components/DataContext'
import { useRouter } from 'next/navigation';
import { addToScratchPad as addToScratchPadService } from '@/components/scratchPadService'

const API_URL = process.env.NEXT_PUBLIC_API_URL

// Type definitions
type Message = {
  role: 'user' | 'assistant'
  content: string
}

type ChatBot = {
  id: string
  name: string
  apiName: string
  messages: Message[]
  persona: string
  conversationId: string
}

type LayoutMode = 'single' | 'dual' | 'quad'

type UploadedFile = {
  name: string
  size: number
}

interface ChatPayload {
  user_id: string;
  conversation_id: string;
  message: string;
  model?: string;
  persona_id?: number;
}

const sidebarNavItems = [
  {
    title: "Scratch Pad",
    href: "/scratch-pad",
    icon: FileText,
  },
  {
    title: "Prompt Library",
    href: "/prompt-templates",
    icon: BookOpen,
  },
  {
    title: "Persona Library",
    href: "/personas",
    icon: Brain,
  },
  {
    title: "Workflows",
    href: "/workflows",
    icon: Workflow,
  },
]

export default function ChatPage() {
  const { chatModels, personas, promptTemplates, categories, isLoading: dataLoading, error, refetchData } = useData()
  const router = useRouter();

  const [allModels, setAllModels] = useState<ChatModel[]>([])
  const [chatbots, setChatbots] = useState<ChatBot[]>([])
  const [input, setInput] = useState('')
  const [activeChatbots, setActiveChatbots] = useState<string[]>([])
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single')
  const [showPromptLibrary, setShowPromptLibrary] = useState(false)
  const [showPersonaLibrary, setShowPersonaLibrary] = useState(false)
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [selectedComplexPrompt, setSelectedComplexPrompt] = useState<PromptTemplate | null>(null)
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [showMainDisplay, setShowMainDisplay] = useState(true)
  const [chatLoading, setChatLoading] = useState<{ [key: string]: boolean }>({})
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [localPersonas, setLocalPersonas] = useState<Persona[]>([])

  useEffect(() => {
    if (!dataLoading && !error && chatModels.length > 0) {
      setAllModels(chatModels)
      const initialChatbots = chatModels.map((model, index) => ({
        id: (index + 1).toString(),
        name: model.name,
        apiName: model.model,
        messages: [],
        persona: 'default',
        conversationId: uuidv4()
      }))
      setChatbots(initialChatbots)
      setActiveChatbots([initialChatbots[0].id])
      setLayoutMode('single')
      setPrompts(promptTemplates)
    }
  }, [dataLoading, error, chatModels, promptTemplates])

  useEffect(() => {
    if (personas.length > 0) {
      setLocalPersonas(personas)
    }
  }, [personas])

  const handleSend = async () => {
    if (input.trim()) {
      const newMessage: Message = { role: 'user', content: input }
      
      setChatbots(chatbots.map(bot => 
        activeChatbots.includes(bot.id) 
          ? { ...bot, messages: [...bot.messages, newMessage] }
          : bot
      ))

      setInput('')

      for (const botId of activeChatbots) {
        const bot = chatbots.find(b => b.id === botId)
        if (bot) {
          setChatLoading(prev => ({ ...prev, [botId]: true }))

          try {
            const personaObject = personas.find(p => p.role === bot.persona)

            const payload: ChatPayload = {
              user_id: "test",
              conversation_id: bot.conversationId,
              message: input,
            }

            if (bot.apiName !== allModels[0].model) {
              payload.model = bot.apiName
            }

            if (personaObject) {
              payload.persona_id = personaObject.id
            }

            console.log(`Sending request for bot ${botId}:`, payload)

            const response = await fetchWithRetry(async () => {
              const res = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
                body: JSON.stringify(payload),
              })
              if (!res.ok) {
                const errorText = await res.text()
                throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`)
              }
              return res
            })

            console.log(`Response status for bot ${botId}:`, response.status)

            setChatbots(chatbots => chatbots.map(cb =>
              cb.id === botId
                ? { ...cb, messages: [...cb.messages, { role: 'assistant', content: '' }] }
                : cb
            ))

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let assistantMessage = ''

            if (reader) {
              const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
                if (event.type === 'event') {
                  const data = event.data
                  if (data === '[DONE]') {
                    return
                  } else {
                    assistantMessage += data

                    setChatbots(chatbots => chatbots.map(cb =>
                      cb.id === botId
                        ? { 
                            ...cb, 
                            messages: cb.messages.map((message, index) => 
                              index === cb.messages.length - 1
                                ? { ...message, content: assistantMessage }
                                : message
                            )
                          }
                        : cb
                    ))
                  }
                }
              })

              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const chunk = decoder.decode(value)
                parser.feed(chunk)
              }
            }
          } catch (error) {
            console.error(`Error for bot ${botId}:`, error)
            setChatbots(chatbots => chatbots.map(cb =>
              cb.id === botId
                ? { ...cb, messages: [...cb.messages, { role: 'assistant', content: 'An error occurred while processing your request. Please try again.' }] }
                : cb
            ))
          } finally {
            setChatLoading(prev => ({ ...prev, [botId]: false }))
          }
        }
      }
    }
  }

  const toggleChatbot = (modelId: string) => {
    const selectedModel = allModels.find(model => model.id.toString() === modelId);
    if (selectedModel) {
      const newChatbot: ChatBot = {
        id: modelId,
        name: selectedModel.name,
        apiName: selectedModel.model,
        messages: [],
        persona: 'default',
        conversationId: uuidv4()
      };

      setChatbots([newChatbot]);
      setActiveChatbots([modelId]);
      setLayoutMode('single');
      setShowMainDisplay(true);
    }
  }

  const setLayout = (mode: LayoutMode) => {
    setLayoutMode(mode)
    if (mode === 'single') {
      setActiveChatbots([chatbots[0].id])
    } else if (mode === 'dual') {
      setActiveChatbots([chatbots[0].id, chatbots[1].id])
    } else {
      setActiveChatbots(chatbots.slice(0, 4).map(bot => bot.id))
    }
  }

  const changeModel = useCallback((botId: string, newModelName: string) => {
    const selectedModel = allModels.find(model => model.name === newModelName);
    if (selectedModel) {
      setChatbots(prevChatbots => prevChatbots.map(bot => 
        bot.id === botId ? { ...bot, name: selectedModel.name, apiName: selectedModel.model } : bot
      ))
      console.log(`Changed model for bot ${botId} to ${newModelName}`);
    }
  }, [allModels])

  const changePersona = (botId: string, newPersonaRole: string) => {
    setChatbots(chatbots.map(bot => 
      bot.id === botId ? { ...bot, persona: newPersonaRole } : bot
    ))
  }

  const handleSelectPrompt = (prompt: PromptTemplate) => {
    if (prompt.is_complex) {
      setSelectedComplexPrompt(prompt)
    } else {
      setInput(prevInput => prevInput + (prevInput ? ' ' : '') + (typeof prompt.prompt === 'string' ? prompt.prompt : ''))
    }
    setShowPromptLibrary(false)
  }

  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    setInput(prevInput => prevInput + (prevInput ? ' ' : '') + generatedPrompt)
  }

  const handleBackFromPromptLibrary = () => {
    setShowPromptLibrary(false)
  }

  const handleBackFromPersonaLibrary = () => {
    setShowPersonaLibrary(false)
  }

  const copyToClipboard = useCallback((botId: string) => {
    const bot = chatbots.find(b => b.id === botId)
    if (bot) {
      const chatContent = bot.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')
      navigator.clipboard.writeText(chatContent).then(() => {
        setCopiedStates(prev => ({ ...prev, [botId]: true }))
        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [botId]: false }))
        }, 2000)
      }).catch(err => {
        console.error('Failed to copy text: ', err)
      })
    }
  }, [chatbots])

  const clearConversation = useCallback((botId: string) => {
    setChatbots(chatbots.map(bot => 
      bot.id === botId ? { ...bot, messages: [], conversationId: uuidv4() } : bot
    ))
  }, [chatbots])

  const clearAllConversations = useCallback(() => {
    setChatbots(chatbots.map(bot => ({ ...bot, messages: [], conversationId: uuidv4() })))
    setInput('')
  }, [chatbots])

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev)
  }

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newFiles = Array.from(files).map(file => ({
        name: file.name,
        size: file.size
      }))
      setUploadedFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(file => file.name !== fileName))
  }

  const addToScratchPad = (botId: string) => {
    const bot = chatbots.find(b => b.id === botId)
    if (bot) {
      const chatContent = bot.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')
      addToScratchPadService(`--- ${bot.name} Chat ---\n${chatContent}`)
      console.log('Added to Scratch Pad:', chatContent) // Add this line for debugging
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)
    if (value.endsWith('/')) {
      setInput(value.slice(0, -1))
      setShowPromptLibrary(true)
    }
  }

  const resetToPlayground = () => {
    setActiveChatbots(['1', '2', '3', '4'])
    setLayoutMode('quad')
    setShowPromptLibrary(false)
    setShowPersonaLibrary(false)
    setShowMainDisplay(true)
  }

  const handleUpdatePersonas = useCallback(async () => {
    try {
      const updatedPersonas = await fetchPersonas()
      setLocalPersonas(updatedPersonas)
    } catch (error) {
      console.error('Error fetching updated personas:', error)
    }
  }, [])

  const navigateToScratchPad = () => {
    router.push('/scratch-pad');
  };

  const navigateToPromptLibrary = () => {
    router.push('/prompt-templates');
  };

  const navigateToPersonaLibrary = () => {
    router.push('/personas');
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-gray-100">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showPromptLibrary ? (
            <PromptLibrary onBack={handleBackFromPromptLibrary} onSelectPrompt={handleSelectPrompt} prompts={prompts} onUpdatePrompts={async () => {}} />
          ) : showPersonaLibrary ? (
            <PersonaLibrary
              onBack={handleBackFromPersonaLibrary}
              personas={localPersonas}
              onUpdatePersonas={handleUpdatePersonas}
            />
          ) : showMainDisplay ? (
            <>
              <div className={`flex-1 grid gap-4 p-4 overflow-hidden ${
                layoutMode === 'single' ? 'grid-cols-1' : 
                layoutMode === 'dual' ? 'grid-cols-2' : 
                'grid-cols-2 grid-rows-2'
              }`}>
                {chatbots.filter(bot => activeChatbots.includes(bot.id)).slice(0, 4).map(bot => (
                  <div key={bot.id} className="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center">
                      <div className="flex items-center">
                        <MessageSquare className="mr-2" size={18} />
                        <span className="text-sm font-medium">{bot.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Select 
                          value={bot.persona} 
                          onValueChange={(value) => changePersona(bot.id, value)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Persona" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            {personas.map((persona) => (
                              <SelectItem key={persona.id} value={persona.role}>{persona.role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select 
                          value={bot.name}
                          onValueChange={(value) => changeModel(bot.id, value)}
                        >
                          <SelectTrigger className="w-[120px]" data-bot-id={bot.id}>
                            <SelectValue placeholder="Model" />
                          </SelectTrigger>
                          <SelectContent>
                            {allModels.map((model) => (
                              <SelectItem key={model.id} value={model.name}>{model.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => addToScratchPad(bot.id)}
                          className="w-8 h-8 p-0"
                          title="Add to Scratch Pad"
                        >
                          <FileText className="h-4 w-4" />
                          <span className="sr-only">Add to Scratch Pad</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(bot.id)}
                          className="w-8 h-8 p-0"
                          title={copiedStates[bot.id] ? "Copied!" : "Copy chat content"}
                        >
                          {copiedStates[bot.id] ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          <span className="sr-only">{copiedStates[bot.id] ? "Copied" : "Copy"}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => clearConversation(bot.id)}
                          className="w-8 h-8 p-0"
                          title="Clear Conversation"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Clear Conversation</span>
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                      {bot.messages.map((msg, index) => (
                        <div key={index} className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                          <div className={`inline-block p-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      ))}
                      {chatLoading[bot.id] && (
                        <div className="text-center">
                          <span className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-900"></span>
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-white border-t">
                <div className="flex items-center space-x-2">
                  <div className={`flex-shrink-0 ${sidebarOpen ? '-ml-4' : ''}`}>
                    <PromptSelector 
                      prompts={prompts} 
                      categories={categories} 
                      onSelectPrompt={handleSelectPrompt}
                    >
                      <Button variant="outline" size="icon" className="w-8 h-8">
                        <BookOpen className="h-4 w-4" />
                        <span className="sr-only">Open Prompt Selector</span>
                      </Button>
                    </PromptSelector>
                  </div>
                  <div className="flex-grow relative">
                    <Textarea 
                      value={input} 
                      onChange={handleInputChange}
                      placeholder="Type your message here... (Use '/' to open prompt library)"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      className="w-full resize-vertical min-h-[40px] pr-20"
                      rows={1}
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleFileUpload}
                        className="h-8 w-8 p-0"
                        title="Upload file"
                      >
                        <Paperclip className="h-4 w-4" />
                        <span className="sr-only">Upload file</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearAllConversations}
                        className="h-8 w-8 p-0"
                        title="Clear all conversations"
                      >
                        <Eraser className="h-4 w-4" />
                        <span className="sr-only">Clear all conversations</span>
                      </Button>
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onFileChange}
                    className="hidden"
                    multiple
                  />
                  <div className="flex-shrink-0 flex space-x-2">
                    <Button onClick={handleSend} className="bg-blue-600 hover:bg-blue-700 text-white">Send</Button>
                    <Button 
                      variant={layoutMode === 'single' ? "default" : "outline"} 
                      size="icon" 
                      onClick={() => setLayout('single')}
                      title="Single chat"
                      className={layoutMode === 'single' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 border-blue-600 hover:bg-blue-100'}
                    >
                      <Square size={18} />
                    </Button>
                    <Button 
                      variant={layoutMode === 'dual' ? "default" : "outline"} 
                      size="icon" 
                      onClick={() => setLayout('dual')}
                      title="Dual chat"
                      className={layoutMode === 'dual' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 border-blue-600 hover:bg-blue-100'}
                    >
                      <Columns size={18} />
                    </Button>
                    <Button 
                      variant={layoutMode === 'quad' ? "default" : "outline"} 
                      size="icon" 
                      onClick={() => setLayout('quad')}
                      title="Quad chat"
                      className={layoutMode === 'quad' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 border-blue-600 hover:bg-blue-100'}
                    >
                      <LayoutGrid size={18} />
                    </Button>
                  </div>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <div className="bg-gray-200 rounded-md p-2 flex items-center">
                          <File className="h-4 w-4 mr-2" />
                          <span className="text-xs truncate max-w-[100px]">{file.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.name)}
                            className="ml-1 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
        {selectedComplexPrompt && (
          <ComplexPromptModal
            prompt={selectedComplexPrompt}
            isOpen={!!selectedComplexPrompt}
            onClose={() => setSelectedComplexPrompt(null)}
            onSubmit={handleComplexPromptSubmit}
          />
        )}
      </div>
    </div>
  );
}
