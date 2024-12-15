'use client'

import { useChat } from 'ai/react'
import ReactMarkdown from 'react-markdown'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageSquare, FileText, Brain, ChevronDown, LayoutGrid, Columns, Square, BookOpen, Copy, Check, Trash2 } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'
import { OpenAIIcon, AnthropicIcon, GeminiIcon, PerplexityIcon, MistralIcon, MetaIcon, ZephyrIcon } from '@/components/icons/ai-provider-icons'
import { useEffect, useRef, useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useData } from '@/components/data-context'
import { ChatModel } from '@/utils/chat-model-service'

export type LayoutMode = 'single' | 'split' | 'grid';

interface ChatInstance {
  id: string;
  modelId: string;
  name: string;
  model: ChatModel;
  persona?: string;
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

interface ChatWindowProps {
  instance: ChatInstance;
  onModelChange: (modelId: string) => void;
  onPersonaChange: (persona: string) => void;
  onCopy: () => void;
  onClear: () => void;
  copiedState: boolean;
  incomingMessage?: string; // message from parent
}

function ChatWindow({ instance, onModelChange, onPersonaChange, onCopy, onClear, copiedState, incomingMessage }: ChatWindowProps) {
  const { chatModels, personas } = useData();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, handleSubmit, isLoading, setInput, setMessages } = useChat({
    api: '/api/chat',
    id: instance.id,
    body: {
      modelId: instance.modelId,
      persona: instance.persona || 'default'
    },
  });

  // If parent sends a message, trigger handleSubmit programmatically
  useEffect(() => {
    if (incomingMessage && incomingMessage.trim() !== '') {
      setInput(incomingMessage);
      handleSubmit(); // call handleSubmit with no arguments
    }
  }, [incomingMessage, handleSubmit, setInput]);
  
  
  

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
      {/* Removed the input form from here */}
    </div>
  );
}

export default function Chat() {
  const { sidebarOpen } = useSidebar()
  const { chatModels, personas, isLoading: dataLoading } = useData()
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single')
  const [chatInstances, setChatInstances] = useState<ChatInstance[]>([])
  const [activeChatIds, setActiveChatIds] = useState<string[]>([])
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [input, setInput] = useState<string>('');  
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

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
    }
  }, [dataLoading, chatModels, chatInstances.length]);

  const handleLayoutChange = (mode: LayoutMode) => {
    const neededInstances = mode === 'split' ? 2 : mode === 'grid' ? 4 : 1;
    
    const newInstances = [];
    for (let i = 0; i < neededInstances; i++) {
      const modelIndex = i % chatModels.length;
      const model = chatModels[modelIndex];
      if (i === 0 && chatInstances.length > 0) {
        // Keep the first instance if it exists
        newInstances.push(chatInstances[0]);
      } else {
        newInstances.push({
          id: uuidv4(),
          modelId: model.id.toString(),
          name: model.name,
          model: model,
          persona: 'default'
        });
      }
    }

    setChatInstances(newInstances);
    setActiveChatIds(newInstances.map(chat => chat.id));
    setLayoutMode(mode);
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
              model: selectedModel,
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
      setLayoutMode('single');
    }
  };

  const copyToClipboard = (chatId: string) => {
    const instance = chatInstances.find(chat => chat.id === chatId);
    if (instance) {
      // For a real copy-to-clipboard, you'd concatenate the messages from that chat here.
      // For now, just show the copied state:
      navigator.clipboard.writeText(`Chat content from ${instance.name}`).then(() => {
        setCopiedStates(prev => ({ ...prev, [chatId]: true }));
        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [chatId]: false }));
        }, 2000);
      });
    }
  };

  const sendMessageToAll = (message: string) => {
    // We simply set a state trigger so that all ChatWindows receive `incomingMessage`
    // This causes each ChatWindow's useEffect to call handleSubmit.
    setTriggerMessage(message);
    // Reset the trigger after a short delay to avoid repeated sends on re-renders
    setTimeout(() => setTriggerMessage(null), 100);
  };

  const handleSubmitGlobal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessageToAll(input.trim());
    setInput('');
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>

          {/* Controls for switching layouts */}
          <div className="p-4 flex space-x-2 border-b">
            <Button onClick={() => setLayoutMode('single')}>Single</Button>
            <Button onClick={() => setLayoutMode('split')}>Split (Dual)</Button>
            <Button onClick={() => setLayoutMode('grid')}>Grid (Quad)</Button>
            {/* On mode change, we must actually call handleLayoutChange */}
            {/* If you want immediate response, call handleLayoutChange when these are clicked: */}
            <Button onClick={() => handleLayoutChange('single')}>Single Mode</Button>
            <Button onClick={() => handleLayoutChange('split')}>Dual Mode</Button>
            <Button onClick={() => handleLayoutChange('grid')}>Quad Mode</Button>
          </div>

          {/* Global input form */}
          <div className="p-4 border-b">
            <form onSubmit={handleSubmitGlobal} className="flex space-x-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-grow resize-none"
                rows={1}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitGlobal(e);
                  }
                }}
              />
              <Button type="submit" disabled={!input.trim()}>
                Send
              </Button>
            </form>
          </div>

          <div className={`flex-1 grid gap-4 p-4 overflow-hidden ${
            layoutMode === 'single' ? 'grid-cols-1' : 
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
                  onClear={() => { /* Implement clearing messages if needed */ }}
                  copiedState={copiedStates[chat.id] || false}
                  incomingMessage={triggerMessage || undefined}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}