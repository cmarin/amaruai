'use client'

import { useChat } from 'ai/react'
import ReactMarkdown from 'react-markdown'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageSquare, FileText, Brain, ChevronDown, LayoutGrid, Columns, Square, BookOpen, Copy, Check, ChevronLeft, ChevronRight, Eraser, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { OpenAIIcon, AnthropicIcon, GeminiIcon, PerplexityIcon, MistralIcon, MetaIcon, ZephyrIcon } from '@/components/icons/ai-provider-icons'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useData } from '@/components/data-context'
import { ChatModel } from '@/utils/chat-model-service'

// Type definitions
export type LayoutMode = 'single' | 'split' | 'grid';

interface ChatInstance {
  id: string;
  modelId: string;
  name: string;
  model: ChatModel;
  persona?: string;
  displayOnly?: boolean;
}

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

export default function Chat() {
  const { sidebarOpen } = useSidebar()
  const { chatModels, personas, isLoading: dataLoading } = useData()
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single')
  const [chatInstances, setChatInstances] = useState<ChatInstance[]>([])
  const [activeChatIds, setActiveChatIds] = useState<string[]>([])
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [selectedModelId, setSelectedModelId] = useState<string>()
  const [selectedPersona, setSelectedPersona] = useState<string>('default')

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages
  } = useChat({
    api: '/api/chat',
    body: {
      modelId: selectedModelId,
      persona: selectedPersona
    },
    onResponse: (response) => {
      if (response.status === 200) {
        console.log('Streaming response received');
        const reader = response.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          const readChunk = async () => {
            const { done, value } = await reader.read();
            if (done) {
              return;
            }
            const chunk = decoder.decode(value);
            
            // Process the chunk
            const lines = chunk.split('\n');
            let content = '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonData = JSON.parse(line.slice(5));
                  if (jsonData.choices && jsonData.choices[0].delta.content) {
                    content += jsonData.choices[0].delta.content;
                  }
                } catch (error) {
                  console.error('Error parsing SSE data:', error);
                }
              }
            }
            
            // Update the messages
            setMessages((prevMessages) => {
              const lastMessage = prevMessages[prevMessages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                return [
                  ...prevMessages.slice(0, -1),
                  { ...lastMessage, content: lastMessage.content + content },
                ];
              } else {
                return [...prevMessages, { role: 'assistant', content, id: Date.now().toString() }];
              }
            });
            
            readChunk();
          };
          readChunk();
        }
      }
    }
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Initialize chat instances when chat models are loaded
  useEffect(() => {
    if (!dataLoading && chatModels.length > 0 && chatInstances.length === 0) {
      const defaultModel = chatModels[0];
      const initialInstance = {
        id: uuidv4(),
        modelId: defaultModel.id.toString(),
        name: defaultModel.name,
        model: defaultModel,
        persona: 'default'
      };
      setChatInstances([initialInstance]);
      setActiveChatIds([initialInstance.id]);
      setSelectedModelId(defaultModel.id.toString());
    }
  }, [dataLoading, chatModels]);

  const handleLayoutChange = (mode: LayoutMode) => {
    const neededInstances = mode === 'split' ? 2 : mode === 'grid' ? 4 : 1;
    
    // Create additional chat instances if needed
    const newInstances = [];
    const mainInstance = chatInstances[0] || {
      id: uuidv4(),
      modelId: chatModels[0]?.id.toString() || '1',
      name: chatModels[0]?.name || 'Default Chat',
      model: chatModels[0],
      persona: 'default',
      displayOnly: false
    };
    newInstances.push(mainInstance);

    // Add display-only instances for the layout
    for (let i = 1; i < neededInstances; i++) {
      const modelIndex = i % chatModels.length;
      const model = chatModels[modelIndex];
      newInstances.push({
        id: uuidv4(),
        modelId: model.id.toString(),
        name: model.name,
        model: model,
        persona: 'default',
        displayOnly: true
      });
    }

    setChatInstances(newInstances);
    setActiveChatIds(newInstances.map(chat => chat.id));
    setLayoutMode(mode);
  }

  const copyToClipboard = (chatId: string) => {
    const chatContent = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')
    navigator.clipboard.writeText(chatContent).then(() => {
      setCopiedStates(prev => ({ ...prev, [chatId]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [chatId]: false }))
      }, 2000)
    })
  }

  const clearChat = () => {
    setMessages([])
  }

  const handleModelChange = (chatId: string, newModelId: string) => {
    const selectedModel = chatModels.find(model => model.id.toString() === newModelId);
    if (selectedModel) {
      setChatInstances(prev =>
        prev.map(chat => {
          if (chat.id === chatId && !chat.displayOnly) {
            setSelectedModelId(newModelId);
            return {
              ...chat,
              modelId: newModelId,
              name: selectedModel.name,
              model: selectedModel
            };
          }
          return chat;
        })
      );
    }
  }

  const handlePersonaChange = (chatId: string, newPersona: string) => {
    setChatInstances(prev =>
      prev.map(chat => {
        if (chat.id === chatId && !chat.displayOnly) {
          setSelectedPersona(newPersona);
          return { ...chat, persona: newPersona };
        }
        return chat;
      })
    );
  }

  const toggleChatbot = (modelId: string) => {
    const selectedModel = chatModels.find(model => model.id.toString() === modelId);
    if (selectedModel) {
      const newInstance = {
        id: uuidv4(),
        modelId: selectedModel.id.toString(),
        name: selectedModel.name,
        model: selectedModel,
        persona: 'default'
      };
      setChatInstances([newInstance]);
      setActiveChatIds([newInstance.id]);
      setSelectedModelId(selectedModel.id.toString());
      setLayoutMode('single');
    }
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className={`flex-1 grid gap-4 p-4 overflow-hidden ${
            layoutMode === 'single' ? 'grid-cols-1' : 
            layoutMode === 'split' ? 'grid-cols-2' : 
            'grid-cols-2 grid-rows-2'
          }`}>
            {chatInstances
              .filter(chat => activeChatIds.includes(chat.id))
              .map(chat => (
                <div key={chat.id} className="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {(() => {
                        const IconComponent = getProviderIcon(chat.modelId, chat.name);
                        return <IconComponent className="mr-2" size={18} />;
                      })()}
                      <Select 
                        value={chat.modelId}
                        onValueChange={(value) => handleModelChange(chat.id, value)}
                        disabled={chat.displayOnly}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue>{chat.name}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {chatModels.map((model) => (
                            <SelectItem key={model.id} value={model.id.toString()}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select 
                        value={chat.persona || 'default'} 
                        onValueChange={(value) => handlePersonaChange(chat.id, value)}
                        disabled={chat.displayOnly}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Persona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          {personas.map((persona) => (
                            <SelectItem key={persona.id} value={persona.role}>
                              {persona.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(chat.id)}
                        className="w-8 h-8 p-0"
                        title={copiedStates[chat.id] ? "Copied!" : "Copy chat content"}
                        disabled={chat.displayOnly}
                      >
                        {copiedStates[chat.id] ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={clearChat}
                        className="w-8 h-8 p-0"
                        title="Clear Chat"
                        disabled={chat.displayOnly}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-4">
                    <div className="flex flex-col gap-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`mb-4 ${
                            message.role === 'user' ? 'text-right' : 'text-left'
                          }`}
                        >
                          <div
                            className={`inline-block p-2 rounded-lg ${
                              message.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-black'
                            }`}
                          >
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>
              ))}
          </div>
          <div className="p-4 bg-white border-t">
            <div className="flex items-center space-x-2">
              <div className="flex-grow">
                <Textarea
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Type your message..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  className="w-full resize-none"
                  rows={1}
                />
              </div>
              <Button
                onClick={(e) => handleSubmit(e)}
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Send
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearChat}
                className="h-8 w-8 p-0"
                title="Clear chat"
              >
                <Eraser className="h-4 w-4" />
              </Button>
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
        </div>
      </div>
    </div>
  )
}

