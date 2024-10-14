import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, Copy, Check } from 'lucide-react'
//import { toast } from "@/components/ui/use-toast"
//import { useToast } from "@/hooks/use-toast"

//const { toast } = useToast()

type ScratchPadProps = {
  content: string
  onContentChange: (content: string) => void
  onBack: () => void
}

export default function ScratchPad({ content, onContentChange, onBack }: ScratchPadProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(err => {
      console.error('Failed to copy text: ', err)
    })
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col h-screen">
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" onClick={onBack} className="mr-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100">
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
          onChange={(e) => onContentChange(e.target.value)}
          className="w-full h-full resize-none"
          placeholder="Your notes and collected conversations will appear here..."
        />
      </div>
    </div>
  )
}