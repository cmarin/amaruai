'use client';  // Add this line at the top of the file

import { FileText, BookOpen, Brain, Workflow, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from 'next/navigation'
import { useData } from '@/components/DataContext'
import { useSidebar } from '@/components/SidebarContext'

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

export function AppSidebar({ toggleChatbot }: AppSidebarProps) {
  const router = useRouter()
  const { chatModels } = useData()
  const { sidebarOpen, toggleSidebar } = useSidebar()

  return (
    <div className={`fixed top-0 left-0 h-full bg-gray-100 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} overflow-hidden`}>
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center p-4">
          {sidebarOpen && <h1 className="text-2xl font-bold">AmaruAI</h1>}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={`hover:bg-gray-200 rounded-full ${sidebarOpen ? '' : 'ml-auto'}`}
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </Button>
        </div>
        <div className="flex-grow overflow-y-auto">
          <div className="space-y-2">
            {sidebarOpen && <div className="px-4 py-2 text-sm font-semibold text-gray-500">AI Tools</div>}
            {aiTools.map((item) => (
              <Button 
                key={item.title}
                variant="ghost"
                className={`w-full justify-start ${sidebarOpen ? 'px-4' : 'px-2'}`}
                onClick={() => router.push(item.href)}
              >
                <item.icon className={sidebarOpen ? "mr-2" : ""} size={18} />
                {sidebarOpen && <span>{item.title}</span>}
              </Button>
            ))}
            {sidebarOpen && <div className="px-4 py-2 text-sm font-semibold text-gray-500">AI Models</div>}
            {chatModels.map((model) => (
              <Button 
                key={model.id}
                variant="ghost"
                className={`w-full justify-start ${sidebarOpen ? 'px-4' : 'px-2'}`}
                onClick={() => toggleChatbot(model.id.toString())}
              >
                <MessageSquare className={sidebarOpen ? "mr-2" : ""} size={18} />
                {sidebarOpen && <span>{model.name}</span>}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
