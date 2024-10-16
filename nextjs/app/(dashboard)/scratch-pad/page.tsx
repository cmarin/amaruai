'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation';
import { getScratchPadContent, setScratchPadContent } from '@/components/scratchPadService'

export default function ScratchPadPage() {
  const [content, setContent] = useState('')
  const [copied, setCopied] = useState(false)
  const router = useRouter();

  useEffect(() => {
    const fetchedContent = getScratchPadContent();
    console.log('Fetched Scratch Pad content:', fetchedContent); // Debug log
    setContent(fetchedContent);
  }, []);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setScratchPadContent(newContent);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(err => {
      console.error('Failed to copy text: ', err)
    })
  }

  const handleBack = () => {
    router.back();
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col h-screen">
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" onClick={handleBack} className="mr-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">Scratch Pad</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={copyToClipboard}
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
      <div className="flex-grow p-4 overflow-hidden">
        <Textarea
          value={content}
          onChange={handleContentChange}
          className="w-full h-full resize-none"
          placeholder="Your notes and collected conversations will appear here..."
        />
      </div>
    </div>
  )
}
