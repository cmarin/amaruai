'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/SidebarContext'
import { OpenAIIcon, AnthropicIcon, GeminiIcon, PerplexityIcon, MistralIcon, MetaIcon, ZephyrIcon } from '@/components/icons/ai-provider-icons'
import { useSession } from '@/app/utils/session/session';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { getApiUrl, getFetchOptions } from '@/lib/apiConfig';
import { ChatService, Message, ChatBot } from '@/components/chat-service'

// Import required Uppy CSS
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';

// Add these imports if you want additional features
// import DropboxPlugin from '@uppy/dropbox';
// import GoogleDrivePlugin from '@uppy/google-drive';
// import WebcamPlugin from '@uppy/webcam';

// Type definitions
type LayoutMode = 'single' | 'split' | 'grid';

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

const getProviderIcon = (modelId: string, modelName: string) => {
  const nameLower = modelName.toLowerCase()
  
  if (nameLower.includes('gpt') || nameLower.includes('o1')) return OpenAIIcon
  if (nameLower.includes('claude')) return AnthropicIcon
  if (nameLower.includes('gemini')) return GeminiIcon
  if (nameLower.includes('perplexity')) return PerplexityIcon
  if (nameLower.includes('mistral') || nameLower.includes('mixtral')) return MistralIcon
  if (nameLower.includes('llama')) return MetaIcon
  if (nameLower.includes('zephyr')) return ZephyrIcon
  return MessageSquare // fallback to default icon
}

export default function ChatPage() {
  const { chatModels, personas, promptTemplates, categories, isLoading: dataLoading, error, refetchData } = useData()
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useSidebar()
  const { session, loading: sessionLoading, getApiHeaders, initialized } = useSession();

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [showMainDisplay, setShowMainDisplay] = useState(true)
  const [chatLoading, setChatLoading] = useState<{ [key: string]: boolean }>({})
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [localPersonas, setLocalPersonas] = useState<Persona[]>([])

  // Add a ref to track if we've initialized from URL
  const initializedFromUrl = useRef(false);

  // Initialize Uppy in a useEffect to avoid SSR issues
  const [uppyInstance, setUppyInstance] = useState<Uppy | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const supabase = createClientComponentClient();

  useEffect(() => {
    const uppy = new Uppy({
      id: 'uppy-chat',
      autoProceed: false,
      restrictions: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxNumberOfFiles: 5,
        allowedFileTypes: ['image/*', 'application/pdf', '.doc', '.docx']
      }
    });

    uppy.on('file-added', async (file) => {
      try {
        if (!file.name) {
          throw new Error('File name is undefined');
        }
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        // Upload file to Supabase storage
        const { data, error } = await supabase.storage
          .from('amaruai-dev')
          .upload(filePath, file.data);

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('amaruai-dev')
          .getPublicUrl(filePath);

        console.log('File uploaded:', publicUrl);
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    });

    uppy.on('complete', (result) => {
      console.log('Upload complete:', result);
      setShowUploadModal(false); // Close the modal after all uploads are complete
    });

    setUppyInstance(uppy);

    // Cleanup
    return () => {
      uppy.cancelAll();
    };
  }, [supabase]);

  // This is the only initialization effect we need
  useEffect(() => {
    if (!dataLoading && !error && chatModels.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      const modelId = searchParams.get('model');
      
      if (modelId) {
        const selectedModel = chatModels.find(model => model.id.toString() === modelId);
        if (selectedModel) {
          const newChatbot = ChatService.createChatBot(selectedModel);
          setChatbots([newChatbot]);
          setActiveChatbots([selectedModel.id.toString()]);
          setLayoutMode('single');
          setAllModels(chatModels);
          initializedFromUrl.current = true;
        }
      } else if (!initializedFromUrl.current) {
        const initialChatbots = ChatService.createInitialChatBots(chatModels);
        setChatbots(initialChatbots);
        setActiveChatbots([initialChatbots[0].id]);
        setAllModels(chatModels);
      }
      setPrompts(promptTemplates);
    }
  }, [dataLoading, error, chatModels, promptTemplates]);

  useEffect(() => {
    if (personas.length > 0) {
      setLocalPersonas(personas)
    }
  }, [personas])

  const handleSend = async () => {
    if (input.trim()) {
      const newMessage: Message = { role: 'user', content: input };
      
      setChatbots(prevBots => ChatService.addMessageToChatBots(prevBots, activeChatbots, newMessage));
      setInput('');

      for (const botId of activeChatbots) {
        const bot = chatbots.find(b => b.id === botId);
        if (bot) {
          setChatLoading(prev => ({ ...prev, [botId]: true }));

          try {
            const headers = getApiHeaders();
            if (!headers) {
              console.error('No valid headers available');
              return;
            }

            const response = await ChatService.sendChatMessage(
              bot,
              input,
              personas,
              allModels,
              headers
            );

            // Process the streamed response
            await ChatService.processStreamedResponse(
              response,
              (chunk) => {
                try {
                  // Try to parse as JSON first
                  let content;
                  try {
                    content = JSON.parse(chunk).content;
                  } catch {
                    // If JSON parsing fails, use the chunk as raw content
                    content = chunk;
                  }

                  setChatbots(prevBots => {
                    return prevBots.map(b => {
                      if (b.id === botId) {
                        const lastMessage = b.messages[b.messages.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                          return {
                            ...b,
                            messages: [
                              ...b.messages.slice(0, -1),
                              { ...lastMessage, content: lastMessage.content + content }
                            ]
                          };
                        } else {
                          return {
                            ...b,
                            messages: [...b.messages, { role: 'assistant', content }]
                          };
                        }
                      }
                      return b;
                    });
                  });
                } catch (e) {
                  console.error('Error processing chunk:', e);
                }
              },
              (error) => {
                console.error('Error processing stream:', error);
                setChatLoading(prev => ({ ...prev, [botId]: false }));
              }
            );
          } catch (error) {
            console.error('Error sending message:', error);
          } finally {
            setChatLoading(prev => ({ ...prev, [botId]: false }));
          }
        }
      }
    }
  }

  const toggleChatbot = (modelId: string) => {
    const selectedModel = chatModels.find(model => model.id.toString() === modelId);
    if (selectedModel) {
      const newChatbot: ChatBot = {
        id: selectedModel.id.toString(),
        name: selectedModel.name,
        apiName: selectedModel.model,
        messages: [],
        persona: 'default',
        conversationId: uuidv4(),
        selectedModelId: selectedModel.id.toString()
      };

      setChatbots([newChatbot]);
      setActiveChatbots([selectedModel.id.toString()]);
      setLayoutMode('single');
      setShowMainDisplay(true);

      // Update URL without page reload
      const url = new URL(window.location.href);
      url.searchParams.set('model', modelId);
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleLayoutChange = (mode: LayoutMode) => {
    // If we need more chatbots than we currently have, create them
    const neededBots = mode === 'split' ? 2 : mode === 'grid' ? 4 : 1;
    
    if (chatbots.length < neededBots) {
      // Create additional chatbots using the available models
      const newBots = allModels.slice(chatbots.length, neededBots).map(model => ChatService.createChatBot(model));
      setChatbots([...chatbots, ...newBots]);
    }

    // Update active chatbots based on layout
    let newActiveBots: string[];
    if (mode === 'single') {
      newActiveBots = chatbots.length > 0 ? [chatbots[0].id] : [];
    } else if (mode === 'split') {
      newActiveBots = chatbots.slice(0, 2).map(bot => bot.id);
    } else {
      // grid mode
      newActiveBots = chatbots.slice(0, 4).map(bot => bot.id);
    }

    setActiveChatbots(newActiveBots);
    setLayoutMode(mode);
  };

  const changeModel = useCallback((botId: string, newModelId: string) => {
    const selectedModel = allModels.find(model => model.id.toString() === newModelId);
    if (selectedModel) {
      setChatbots(prevChatbots => prevChatbots.map(bot => 
        bot.id === botId ? { 
          ...bot, 
          selectedModelId: selectedModel.id.toString(),
          name: selectedModel.name,
          apiName: selectedModel.model
        } : bot
      ));
    }
  }, [allModels]);

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

  const handleFileUpload = () => {
    setShowUploadModal(true);
  };

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
    setLayoutMode('grid')
    setShowPromptLibrary(false)
    setShowPersonaLibrary(false)
    setShowMainDisplay(true)
  }

  const handleUpdatePersonas = useCallback(async () => {
    const headers = getApiHeaders();
    if (!headers) {
      console.error('No valid headers available');
      return;
    }
    try {
      const updatedPersonas = await fetchPersonas(headers);
      setLocalPersonas(updatedPersonas);
    } catch (error) {
      console.error('Error fetching updated personas:', error);
    }
  }, [getApiHeaders]);

  const navigateToScratchPad = () => {
    router.push('/scratch-pad');
  };

  const navigateToPromptLibrary = () => {
    router.push('/prompt-templates');
  };

  const navigateToPersonaLibrary = () => {
    router.push('/personas');
  };

  // Memoize the model options to prevent unnecessary re-renders
  const modelOptions = useMemo(() => 
    chatModels.map(model => ({
      value: model.id.toString(),
      label: model.name,
      model: model
    })), [chatModels]
  );

  // Memoize the persona options
  const personaOptions = useMemo(() => 
    personas.map(persona => ({
      value: persona.id.toString(),
      label: persona.role,
      persona: persona
    })), [personas]
  );

  // Use refs for values that shouldn't trigger re-renders
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Memoize handlers
  const handleModelChange = useCallback((modelId: string, chatbotId: string) => {
    setChatbots(prev => prev.map(bot => 
      bot.id === chatbotId ? { ...bot, apiName: modelId } : bot
    ));
  }, []);

  const handlePersonaChange = useCallback((personaId: string, chatbotId: string) => {
    setChatbots(prev => prev.map(bot => 
      bot.id === chatbotId ? { ...bot, persona: personaId } : bot
    ));
  }, []);

  const modalRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (event: MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      setShowUploadModal(false);
    }
  };

  useEffect(() => {
    if (showUploadModal) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUploadModal]);

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white"> 
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          {showPromptLibrary ? (
            <PromptLibrary onBack={handleBackFromPromptLibrary} onSelectPrompt={handleSelectPrompt} prompts={prompts} onUpdatePrompts={async () => {}} />
          ) : showPersonaLibrary ? (
            <PersonaLibrary
              personas={localPersonas}
              onUpdatePersonas={handleUpdatePersonas}
            />
          ) : showMainDisplay ? (
            <>
              <div className={`flex-1 grid gap-4 p-4 overflow-hidden ${
                layoutMode === 'single' ? 'grid-cols-1' : 
                layoutMode === 'split' ? 'grid-cols-2' : 
                'grid-cols-2 grid-rows-2'
              }`}>
                {chatbots.filter(bot => activeChatbots.includes(bot.id)).slice(0, 4).map(bot => (
                  <div key={bot.id} className="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center">
                      <div className="flex items-center">
                        {(() => {
                          const IconComponent = getProviderIcon(bot.selectedModelId, bot.name)
                          return <IconComponent className="mr-2" size={18} />
                        })()}
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
                          value={bot.selectedModelId}
                          onValueChange={(value) => changeModel(bot.id, value)}
                        >
                          <SelectTrigger className="w-[120px]" data-bot-id={bot.id}>
                            <SelectValue placeholder="Model">
                              {allModels.find(m => m.id.toString() === bot.selectedModelId)?.name}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {allModels.map((model) => (
                              <SelectItem key={model.id} value={model.id.toString()}>
                                {model.name}
                              </SelectItem>
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
                      variant={layoutMode === 'single' ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => handleLayoutChange('single')}
                      title="Single chat"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={layoutMode === 'split' ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => handleLayoutChange('split')}
                      title="Split chat"
                    >
                      <Columns className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={layoutMode === 'grid' ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => handleLayoutChange('grid')}
                      title="Grid chat"
                    >
                      <LayoutGrid className="h-4 w-4" />
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
      {/* Uppy Dashboard Modal */}
      {uppyInstance && showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div ref={modalRef} className="bg-white rounded-lg p-4 relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowUploadModal(false)}
              className="absolute top-2 right-2"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
            <Dashboard
              uppy={uppyInstance}
              width={750}
              height={550}
              showProgressDetails={true}
              proudlyDisplayPoweredByUppy={false}
              onRequestCloseModal={() => setShowUploadModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
