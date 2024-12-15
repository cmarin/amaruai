'use client'

import { useChat, type Message } from 'ai/react'
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
import { Input } from "@/components/ui/input"

// Type definitions
export type LayoutMode = 'single' | 'split' | 'grid';

interface ChatInstance {
  id: string;
  modelId: string;
  name: string;
  model: ChatModel;
  persona?: string;
  messages: Message[]; // Array to store messages for this chat instance (using Message type from ai/react)
  input: string;   // Input for this chat instance
  isLoading: boolean;
  handleSubmit: (e: any) => void;
  handleInputChange: (e: any) => void;
  setMessages: (messages: any[]) => void;
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

function ChatWindow({ instance, onModelChange, onPersonaChange, onCopy, onClear, copiedState }: {
  instance: ChatInstance;
  onModelChange: (modelId: string) => void;
  onPersonaChange: (persona: string) => void;
  onCopy: () => void;
  onClear: () => void;
  copiedState: boolean;
}) {
  const { chatModels, personas } = useData();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [instance.messages]);

  return (
    <div className="bg-white rounded-lg shadow flex flex-col overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {(() => {
            const IconComponent = getProviderIcon(instance.modelId, instance.name);
            return <IconComponent className="mr-2" size={18} />;
          })()}
          <Select
            value={instance.modelId}
            onValueChange={onModelChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue>{instance.name}</SelectValue>
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
            value={instance.persona || 'default'}
            onValueChange={onPersonaChange}
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
            onClick={onCopy}
            className="w-8 h-8 p-0"
            title={copiedState ? "Copied!" : "Copy chat content"}
          >
            {copiedState ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onClear}
            className="w-8 h-8 p-0"
            title="Clear Chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {instance.messages.map((message: Message) => (
            <div
              key={message.id}
              className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'
                }`}
            >
              <div
                className={`inline-block p-2 rounded-lg ${message.role === 'user'
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
  );
}

function ChatInput({ onSubmit, onInputChange, inputValue }: {
  onSubmit: (e: any) => void;
  onInputChange: (e: any) => void;
  inputValue: string;
}) {
  return (
    <div className="p-4 border-t">
      <form onSubmit={onSubmit} className="flex space-x-2">
        <Textarea
          value={inputValue}
          onChange={onInputChange}
          placeholder="Type your message..."
          className="flex-grow resize-none"
          rows={1}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
        />
        <Button type="submit">
          Send
        </Button>
      </form>
    </div>
  )
}

export default function Chat() {
  const { sidebarOpen } = useSidebar()
  const { chatModels, personas, isLoading: dataLoading } = useData()
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single')
  const [chatInstances, setChatInstances] = useState<ChatInstance[]>([])
  const [activeChatIds, setActiveChatIds] = useState<string[]>([])
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [globalInput, setGlobalInput] = useState('')
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);

  // Initialize chat instances when chat models are loaded
  useEffect(() => {
    if (!dataLoading && chatModels.length > 0 && chatInstances.length === 0) {
      const defaultModel = chatModels[0];
      const initialInstance = initializeChatInstance(defaultModel);
      setChatInstances([initialInstance]);
      setActiveChatIds([initialInstance.id]);
    }
  }, [dataLoading, chatModels, chatInstances.length]);

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    const neededInstances = mode === 'split' ? 2 : mode === 'grid' ? 4 : 1;

    setChatInstances(prevInstances => {
      const newInstances = [];
      for (let i = 0; i < neededInstances; i++) {
        if (i < prevInstances.length) {
          // Reuse existing instances
          newInstances.push(prevInstances[i]);
        } else {
          // Create new instances for models that don't have one yet
          const modelIndex = i % chatModels.length;
          const model = chatModels[modelIndex];
          newInstances.push(initializeChatInstance(model));
        }
      }
      setActiveChatIds(newInstances.map(instance => instance.id));
      return newInstances;
    });
  };

  const initializeChatInstance = (model: ChatModel): ChatInstance => {
    const instanceId = uuidv4();
    const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
      api: '/api/chat',
      id: instanceId,
      body: {
        modelId: model.id.toString(),
        persona: 'default'
      },
      onResponse: (response) => {
        if (response.status === 200) {
          console.log('Streaming response received for', model.name);
          const reader = response.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            const readChunk = async () => {
              const { done, value } = await reader.read();
              if (done) {
                return;
              }
              const chunk = decoder.decode(value);
              console.log("Received chunk:", chunk);

              // Process the chunk using the Vercel AI SDK
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const jsonData = JSON.parse(line.slice(6));
                    console.log('Parsed SSE data:', jsonData);
                    if (jsonData.chatId === instanceId && jsonData.content) {
                      // Update the messages for the specific instance using setMessages from useChat
                      setMessages(prevMessages => {
                        const lastMessage = prevMessages[prevMessages.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                          return [
                            ...prevMessages.slice(0, -1),
                            { ...lastMessage, content: lastMessage.content + jsonData.content },
                          ];
                        } else {
                          return [...prevMessages, { role: 'assistant', content: jsonData.content, id: Date.now().toString() }];
                        }
                      });
                    }
                  } catch (error) {
                    console.error('Error parsing SSE data:', error);
                  }
                }
              }

              readChunk();
            };
            readChunk();
          }
        }
      },
      onFinish: (message) => {
        console.log('Message finished for', model.name, ':', message);
      },
    });

    return {
      id: instanceId,
      modelId: model.id.toString(),
      name: model.name,
      model: model,
      persona: 'default',
      messages,
      input,
      isLoading,
      handleSubmit,
      handleInputChange,
      setMessages
    };
  };

  const handleModelChange = (chatId: string, newModelId: string) => {
    const selectedModel = chatModels.find(model => model.id.toString() === newModelId);
    if (selectedModel) {
      setChatInstances(prev =>
        prev.map(chat => {
          if (chat.id === chatId) {
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
  };

  const handlePersonaChange = (chatId: string, newPersona: string) => {
    setChatInstances(prev =>
      prev.map(chat => {
        if (chat.id === chatId) {
          return { ...chat, persona: newPersona };
        }
        return chat;
      })
    );
  };

  const handleGlobalInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGlobalInput(event.target.value);
  };

  const handleGlobalSubmit = async (event: any) => {
    event.preventDefault();
    const userMessageId = uuidv4();
    setLastUserMessageId(userMessageId);

    // Update each chat instance with the new user message
    setChatInstances(prevInstances =>
      prevInstances.map(instance => ({
        ...instance,
        messages: [...instance.messages, { id: userMessageId, role: 'user', content: globalInput }],
        input: '', // Clear the input field
        isLoading: true,
      }))
    );

    const updatedChatInstances = chatInstances.map(instance => ({
      ...instance,
      messages: [...instance.messages, { id: userMessageId, role: 'user', content: globalInput }],
      isLoading: true,
    }));

    // Send requests for each chat instance
    await Promise.all(updatedChatInstances.map(instance => instance.handleSubmit(event)));

    setGlobalInput(''); // Clear the global input after submitting
  };

  const toggleChatbot = (modelId: string) => {
    const selectedModel = chatModels.find(model => model.id.toString() === modelId);
    if (selectedModel) {
      const newInstance = initializeChatInstance(selectedModel);
      setChatInstances([newInstance]);
      setActiveChatIds([newInstance.id]);
      setLayoutMode('single');
    }
  };

  const copyToClipboard = (chatId: string) => {
    const instance = chatInstances.find(chat => chat.id === chatId);
    if (instance) {
      const chatContent = instance.messages
        .map(message => `${message.role}: ${message.content}`)
        .join('\n');

      navigator.clipboard.writeText(chatContent).then(() => {
        setCopiedStates(prev => ({ ...prev, [chatId]: true }));
        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [chatId]: false }));
        }, 2000);
      });
    }
  };

  const clearChat = (chatId: string) => {
    setChatInstances(prevInstances =>
      prevInstances.map(instance => {
        if (instance.id === chatId) {
          return { ...instance, messages: [] };
        }
        return instance;
      })
    );
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="p-4">
            <div className="flex space-x-4">
              <Button
                variant={layoutMode === 'single' ? 'default' : 'outline'}
                onClick={() => handleLayoutChange('single')}
              >
                <Square className="mr-2" size={16} />
                Single
              </Button>
              <Button
                variant={layoutMode === 'split' ? 'default' : 'outline'}
                onClick={() => handleLayoutChange('split')}
              >
                <Columns className="mr-2" size={16} />
                Dual
              </Button>
              <Button
                variant={layoutMode === 'grid' ? 'default' : 'outline'}
                onClick={() => handleLayoutChange('grid')}
              >
                <LayoutGrid className="mr-2" size={16} />
                Quad
              </Button>
            </div>
          </div>
          <div className={`flex-1 grid gap-4 p-4 overflow-hidden ${layoutMode === 'single' ? 'grid-cols-1' :
            layoutMode === 'split' ? 'grid-cols-2' :
              'grid-cols-2 grid-rows-2'
            }`}>
            {chatInstances
              .filter(chat => activeChatIds.includes(chat.id))
              .map((chat) => (
                <ChatWindow
                  key={chat.id}
                  instance={chat}
                  onModelChange={(modelId) => handleModelChange(chat.id, modelId)}
                  onPersonaChange={(persona) => handlePersonaChange(chat.id, persona)}
                  onCopy={() => copyToClipboard(chat.id)}
                  onClear={() => clearChat(chat.id)}
                  copiedState={copiedStates[chat.id] || false}
                />
              ))}
          </div>
          <ChatInput
            onSubmit={handleGlobalSubmit}
            onInputChange={handleGlobalInputChange}
            inputValue={globalInput}
          />
        </div>
      </div>
    </div>
  )
}