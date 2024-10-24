'use client';  // Add this line at the top of the file

import { FileText, BookOpen, Brain, Workflow, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from 'next/navigation'
import { useData } from '@/components/DataContext'
import { useSidebar } from '@/components/SidebarContext'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
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
    <div className={`fixed top-0 left-0 h-full transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-100 overflow-hidden`}>
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center p-4">
          {sidebarOpen && (
            <h1 className="text-2xl font-bold">AmaruAI</h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hover:bg-gray-200 rounded-full"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </Button>
        </div>
        <div className="flex-grow overflow-y-auto">
          <SidebarMenu>
            {aiTools.map((item) => (
              <SidebarMenuItem key={item.title}>
                <Button 
                  variant="ghost"
                  className={`justify-start w-full ${sidebarOpen ? 'px-4' : 'px-2'}`}
                  onClick={() => router.push(item.href)}
                >
                  <item.icon className={sidebarOpen ? "mr-2" : ""} size={18} />
                  {sidebarOpen && <span>{item.title}</span>}
                </Button>
              </SidebarMenuItem>
            ))}
            {chatModels.map((model) => (
              <SidebarMenuItem key={model.id}>
                <Button 
                  variant="ghost"
                  className={`justify-start w-full ${sidebarOpen ? 'px-4' : 'px-2'}`}
                  onClick={() => toggleChatbot(model.id.toString())}
                >
                  <MessageSquare className={sidebarOpen ? "mr-2" : ""} size={18} />
                  {sidebarOpen && <span>{model.name}</span>}
                </Button>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </div>
    </div>
  )
}
