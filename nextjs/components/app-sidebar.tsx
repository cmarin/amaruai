'use client';  // Add this line at the top of the file

import { FileText, BookOpen, Brain, Workflow, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { useData } from '@/components/DataContext'

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

export function AppSidebar() {
  const router = useRouter()
  const { chatModels } = useData()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="relative">
      <Sidebar className={`transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
        <SidebarContent>
          <SidebarGroup>
            <div className="flex justify-between items-center p-4">
              {sidebarOpen && (
                <h1 className="text-2xl font-bold">AmurAI</h1>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className={`hover:bg-gray-200 rounded-full ${sidebarOpen ? '' : 'ml-auto'}`}
              >
                {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </Button>
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarOpen && <SidebarGroupLabel>AI Tools</SidebarGroupLabel>}
                {aiTools.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Button 
                        variant="ghost"
                        className={`justify-start w-full ${sidebarOpen ? '' : 'px-2'}`}
                        onClick={() => router.push(item.href)}
                      >
                        <item.icon className={sidebarOpen ? "mr-2" : ""} size={18} />
                        {sidebarOpen && <span>{item.title}</span>}
                      </Button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {sidebarOpen && <SidebarGroupLabel>AI Models</SidebarGroupLabel>}
                {chatModels.map((model) => (
                  <SidebarMenuItem key={model.id}>
                    <SidebarMenuButton asChild>
                      <Button 
                        variant="ghost"
                        className={`justify-start w-full ${sidebarOpen ? '' : 'px-2'}`}
                        onClick={() => router.push(`/chat?model=${model.model}`)}
                      >
                        <MessageSquare className={sidebarOpen ? "mr-2" : ""} size={18} />
                        {sidebarOpen && <span>{model.name}</span>}
                      </Button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </div>
  )
}
