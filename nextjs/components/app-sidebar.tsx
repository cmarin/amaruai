'use client';  // Add this line at the top of the file

import Image from 'next/image'
import { FileText, BookOpen, Brain, Workflow, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from 'next/navigation'
import { useData } from '@/components/DataContext'
import { useSidebar } from '@/components/SidebarContext'
import { OpenAIIcon, AnthropicIcon, GeminiIcon, PerplexityIcon, MistralIcon, MetaIcon, ZephyrIcon, O1Icon } from './icons/ai-provider-icons'

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
    title: "Workflows",
    href: "/workflows",
    icon: Workflow,
  },
]

interface AppSidebarProps {
  toggleChatbot: (modelId: string) => void;
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

export function AppSidebar({ toggleChatbot }: AppSidebarProps) {
  const router = useRouter()
  const { chatModels } = useData()
  const { sidebarOpen, toggleSidebar } = useSidebar()

  return (
    <div className={`fixed top-0 left-0 h-full bg-gray-100 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-14'} overflow-hidden`}>
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <Image 
                src="/images/amaruai_logo.svg"
                alt="AmaruAI Logo"
                width={36}
                height={36}
              />
              <h1 className="text-xl font-bold">AmaruAI</h1>
            </div>
          ) : (
            <Image 
              src="/images/amaruai_logo.svg"
              alt="AmaruAI Logo"
              width={16}
              height={16}
              className="ml-[-5px]"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={`hover:bg-gray-200 rounded-full ${sidebarOpen ? '' : 'ml-auto'}`}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </Button>
        </div>
        <div className="flex-grow overflow-y-auto">
          <div className="space-y-1">
            {sidebarOpen && <div className="px-3 py-2 text-xs font-semibold text-gray-500">AI Tools</div>}
            {aiTools.map((item) => (
              <Button 
                key={item.title}
                variant="ghost"
                className={`w-full justify-start ${sidebarOpen ? 'px-3' : 'px-2'} py-2`}
                onClick={() => router.push(item.href)}
              >
                <item.icon className={sidebarOpen ? "mr-2" : ""} size={16} />
                {sidebarOpen && <span className="text-sm">{item.title}</span>}
              </Button>
            ))}
            {sidebarOpen && <div className="px-3 py-2 text-xs font-semibold text-gray-500">AI Models</div>}
            {chatModels.map((model) => {
              const IconComponent = getProviderIcon(model.id.toString(), model.name)
              return (
                <Button 
                  key={model.id}
                  variant="ghost"
                  className={`w-full justify-start ${sidebarOpen ? 'px-3' : 'px-2'} py-2`}
                  onClick={() => toggleChatbot(model.id.toString())}
                >
                  <IconComponent className={sidebarOpen ? "mr-2" : ""} size={16} />
                  {sidebarOpen && <span className="text-sm">{model.name}</span>}
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
