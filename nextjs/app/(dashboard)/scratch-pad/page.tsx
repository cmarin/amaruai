'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getScratchPadContent, setScratchPadContent } from '@/utils/scratch-pad-service'
import { Copy, Check } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/sidebar-context'

export default function ScratchPadPage() {
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);
  const { sidebarOpen } = useSidebar();

  useEffect(() => {
    const fetchedContent = getScratchPadContent();
    console.log('Fetched Scratch Pad content:', fetchedContent);
    setContent(fetchedContent);
  }, []);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setScratchPadContent(newContent);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const toggleChatbot = (modelId: string) => {
    // Implement this function or pass it as a prop if needed
  };

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="flex justify-between items-center p-4 border-b">
            <h1 className="text-2xl font-bold">Scratch Pad</h1>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="w-10 h-10 p-0"
              title={copied ? "Copied!" : "Copy to clipboard"}
            >
              {copied ? (
                <Check className="h-5 w-5" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
              <span className="sr-only">{copied ? "Copied" : "Copy to clipboard"}</span>
            </Button>
          </div>
          <ScrollArea className="flex-grow p-4">
            <Textarea
              value={content}
              onChange={handleContentChange}
              className="w-full h-full min-h-[calc(100vh-120px)]"
              placeholder="Type your notes here..."
            />
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
