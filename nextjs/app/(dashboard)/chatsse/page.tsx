'use client'

import { useChat } from 'ai/react'
import ReactMarkdown from 'react-markdown'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect, useRef } from 'react'

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: '/api/chat',
    onResponse: (response) => {
      if (response.status === 200) {
        console.log('Streaming response received');
        const reader = response.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          const readChunk = async () => {
            const { done, value } = await reader.read();
            if (done) {
              return;
            }
            const chunk = decoder.decode(value);
            
            // Process the chunk
            const lines = chunk.split('\n');
            let content = '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonData = JSON.parse(line.slice(5));
                  if (jsonData.choices && jsonData.choices[0].delta.content) {
                    content += jsonData.choices[0].delta.content;
                  }
                } catch (error) {
                  console.error('Error parsing SSE data:', error);
                }
              }
            }
            
            // Update the messages
            setMessages((prevMessages) => {
              const lastMessage = prevMessages[prevMessages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                return [
                  ...prevMessages.slice(0, -1),
                  { ...lastMessage, content: lastMessage.content + content },
                ];
              } else {
                return [...prevMessages, { role: 'assistant', content, id: Date.now().toString() }];
              }
            });
            
            readChunk();
          };
          readChunk();
        }
      }
    },
    onFinish: (message) => {
      console.log('Message finished:', message);
    },
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>AI Infinity</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-200px)] mb-4 p-4">
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
          </ScrollArea>
        </CardContent>
        <CardFooter>
          <form onSubmit={handleSubmit} className="flex w-full space-x-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="flex-grow"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Thinking...' : 'Send'}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}

