'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, RotateCcw, Trash2, ChevronDown, Paperclip, Send, BookOpen, Grid2X2, Columns, Square, Loader2, Timer, Bot, Sparkles, SmilePlus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chat() {
  const { sidebarOpen, toggleSidebar } = useSidebar()
  const [messages, setMessages] = useState<Message[]>([])
  const [messages2, setMessages2] = useState<Message[]>([])
  const [messages3, setMessages3] = useState<Message[]>([])
  const [messages4, setMessages4] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [mode, setMode] = useState('single')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesEndRef2 = useRef<HTMLDivElement>(null)
  const messagesEndRef3 = useRef<HTMLDivElement>(null)
  const messagesEndRef4 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (messagesEndRef2.current) {
      messagesEndRef2.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages2])

  useEffect(() => {
    if (messagesEndRef3.current) {
      messagesEndRef3.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages3])

  useEffect(() => {
    if (messagesEndRef4.current) {
      messagesEndRef4.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages4])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    setIsLoading(true)
    setError(null)

    const newMessage: Message = { role: 'user' as const, content: input }
    setMessages((prevMessages) => [...prevMessages, newMessage])
    setMessages2((prevMessages) => [...prevMessages, newMessage])
    setMessages3((prevMessages) => [...prevMessages, newMessage])
    setMessages4((prevMessages) => [...prevMessages, newMessage])
    setInput('')

    const makeApiCall = async (messages: Message[], setMessagesFunction: React.Dispatch<React.SetStateAction<Message[]>>) => {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages: [...messages, newMessage] }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let assistantMessage = '';
        setMessagesFunction(prevMessages => [...prevMessages, { role: 'assistant' as const, content: '' }]);

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonData = line.slice(5).trim();
              if (jsonData !== '[DONE]') {
                try {
                  const parsed = JSON.parse(jsonData);
                  if (parsed.choices && parsed.choices[0].delta.content) {
                    assistantMessage += parsed.choices[0].delta.content;
                    setMessagesFunction(prevMessages => {
                      const newMessages = [...prevMessages];
                      newMessages[newMessages.length - 1] = { role: 'assistant' as const, content: assistantMessage };
                      return newMessages;
                    });
                  }
                } catch (parseError) {
                  console.error('Error parsing response line:', parseError, line);
                }
              }
            }
          }
        }
      } catch (error: unknown) {
        console.error('Error in API call:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        setError(prevError => 
          prevError ? 
            new Error(`${prevError.message}\n${errorMessage}`) : 
            new Error(errorMessage)
        );
      }
    };

    const apiCalls = [
      makeApiCall(messages, setMessages),
      mode !== 'single' && makeApiCall(messages2, setMessages2),
      mode === 'quad' && makeApiCall(messages3, setMessages3),
      mode === 'quad' && makeApiCall(messages4, setMessages4)
    ].filter(Boolean);

    try {
      await Promise.all(apiCalls);
    } catch (error: unknown) {
      console.error('Error in handleSubmit:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(prevError => 
        prevError ? 
          new Error(`${prevError.message}\n${errorMessage}`) : 
          new Error(errorMessage)
      );
    } finally {
      setIsLoading(false);
    }
  }

  interface ChatWindowProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
    title: string;
    Icon: React.ComponentType<any>;
  }

  const ChatWindow = ({ messages, messagesEndRef, title, Icon }: ChatWindowProps) => (
    <TooltipProvider>
    <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            <span className="font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Select>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="poet">Poet</SelectItem>
                <SelectItem value="marketer">Marketer</SelectItem>
                <SelectItem value="comedian">Comedian</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={title} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="perplexity">Perplexity Llama</SelectItem>
                <SelectItem value="gpt4">GPT-4o</SelectItem>
                <SelectItem value="gemini">Gemini 1.5 Pro</SelectItem>
                <SelectItem value="llama">Meta Llama 3.1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <BookOpen className="w-4 h-4" />
                <span className="sr-only">Add to Scratch Pad</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add to Scratch Pad</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <Copy className="w-4 h-4" />
                <span className="sr-only">Copy to Clipboard</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy to Clipboard</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <Trash2 className="w-4 h-4" />
                <span className="sr-only">Clear Conversation</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear Conversation</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
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
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
    </TooltipProvider>
  )

  return (
    <div className="flex h-screen">
      <AppSidebar toggleChatbot={() => {}} />
      <main className={`flex-1 flex flex-col h-screen transition-all duration-300 ease-in-out ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="flex-1 flex flex-col">
          <div className="grid h-full gap-4 p-4" style={{ gridTemplateColumns: mode === 'single' ? '1fr' : mode === 'dual' ? '1fr 1fr' : '1fr 1fr' }}>
            <ChatWindow 
              messages={messages} 
              messagesEndRef={messagesEndRef}
              title="Perplexity Llama"
              Icon={Timer}
            />
            {mode !== 'single' && (
              <ChatWindow 
                messages={messages2} 
                messagesEndRef={messagesEndRef2}
                title="GPT-4o"
                Icon={Sparkles}
              />
            )}
            {mode === 'quad' && (
              <>
                <ChatWindow 
                  messages={messages3} 
                  messagesEndRef={messagesEndRef3}
                  title="Gemini 1.5 Pro"
                  Icon={Bot}
                />
                <ChatWindow 
                  messages={messages4} 
                  messagesEndRef={messagesEndRef4}
                  title="Meta Llama 3.1"
                  Icon={SmilePlus}
                />
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 p-4 border-t">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button onClick={(e) => handleSubmit(e)} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant={mode === 'single' ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setMode('single')}
              title="Single chat"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              variant={mode === 'dual' ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setMode('dual')}
              title="Split view"
            >
              <Columns className="h-4 w-4" />
            </Button>
            <Button
              variant={mode === 'quad' ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setMode('quad')}
              title="Grid view"
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
