'use client';

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FileText, BookOpen, Brain, Workflow, MessageSquare, ChevronLeft, ChevronRight, User2, Files, Database, Users, Settings, Menu, Sparkles } from "lucide-react"
import { useRouter } from 'next/navigation'
import { useData } from '@/components/data-context'
import { useSidebar } from '@/components/sidebar-context'
import { OpenAIIcon, AnthropicIcon, GeminiIcon, PerplexityIcon, MistralIcon, MetaIcon, ZephyrIcon, O1Icon } from './icons/ai-provider-icons'
import { useSupabase } from '@/app/contexts/SupabaseContext'
import { User } from '@supabase/supabase-js'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const aiTools = [
  {
    title: "Chat",
    href: "/chat",
    icon: MessageSquare,
  },
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
    title: "Knowledge Bases",
    href: "/knowledge-bases",
    icon: Database,
  },
  {
    title: "Workflows",
    href: "/workflows",
    icon: Workflow,
  },
  {
    title: "Batch Flow",
    href: "/batch-flow",
    icon: Files,
  },
  {
    title: "Content Fusion",
    href: "/fusion",
    icon: Brain,
  },
  {
    title: "Content Remix",
    href: "/content-remix",
    icon: Sparkles,
  },
]

interface AppSidebarProps {
  toggleChatbot?: (modelId: string) => void;
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

export function AppSidebar({ toggleChatbot: propToggleChatbot }: AppSidebarProps) {
  const router = useRouter()
  const { chatModels: allModels, favoriteChatModels } = useData()
  const { sidebarOpen, toggleSidebar } = useSidebar()
  const [user, setUser] = useState<User | null>(null)
  const supabase = useSupabase()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleToggleChatbot = (modelId: string) => {
    if (window.location.pathname === '/chat') {
      propToggleChatbot?.(modelId);
    } else {
      router.push(`/chat?model=${modelId}`);
    }
  };

  const chatModels = favoriteChatModels;

  return (
    <div className={`fixed top-0 left-0 h-full bg-gray-100 dark:bg-gray-900 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-14'} overflow-hidden`}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <Image 
                src="/images/amaruai_logo.svg"
                alt="AmaruAI Logo"
                width={36}
                height={36}
                style={{ width: 'auto', height: '36px' }}
              />
              <h1 className="text-xl font-bold dark:text-white">AmaruAI</h1>
            </div>
          ) : (
            <Image 
              src="/images/amaruai_logo.svg"
              alt="AmaruAI Logo"
              width={16}
              height={16}
              style={{ width: 'auto', height: '16px' }}
              className="ml-[-5px]"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={`hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full ${sidebarOpen ? '' : 'ml-auto'}`}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </Button>
        </div>

        {/* Main content */}
        <div className="flex-grow overflow-y-auto">
          <div className="space-y-1">
            {sidebarOpen && <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">AI Tools</div>}
            {aiTools.map((item) => (
              <Button 
                key={item.title}
                variant="ghost"
                className={`w-full justify-start ${sidebarOpen ? 'px-3' : 'px-2'} py-2 dark:text-gray-200 dark:hover:text-white dark:hover:bg-gray-800`}
                onClick={() => router.push(item.href)}
              >
                <item.icon className={sidebarOpen ? "mr-2" : ""} size={16} />
                {sidebarOpen && <span className="text-sm">{item.title}</span>}
              </Button>
            ))}
            {chatModels.length > 0 && (
              <>
                {sidebarOpen && <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">AI Models</div>}
                {chatModels.map((model) => {
                  const IconComponent = getProviderIcon(model.id.toString(), model.name)
                  return (
                    <Button 
                      key={model.id}
                      variant="ghost"
                      className={`w-full justify-start ${sidebarOpen ? 'px-3' : 'px-2'} py-2 dark:text-gray-200 dark:hover:text-white dark:hover:bg-gray-800`}
                      onClick={() => handleToggleChatbot(model.id.toString())}
                    >
                      <IconComponent className={sidebarOpen ? "mr-2" : ""} size={16} />
                      {sidebarOpen && <span className="text-sm">{model.name}</span>}
                    </Button>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* User footer section */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 dark:text-gray-200 dark:hover:text-white dark:hover:bg-gray-800">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback>
                    {user?.email?.charAt(0).toUpperCase() || <User2 size={16} />}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <span className="text-sm truncate">
                    {user?.email || 'Guest'}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              <DropdownMenuItem onClick={() => router.push('/account')}>
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
