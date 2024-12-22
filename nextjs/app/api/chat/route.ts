// app/api/chat/route.ts
import { NextRequest } from 'next/server'
import { getApiUrl } from '@/utils/api-utils'

export const runtime = 'edge'

interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>
  user_id?: string
  model_id?: string
  persona_id?: string
  files?: Array<{ name: string; url: string }>
}

export async function POST(req: NextRequest) {
  try {
    console.log('Received POST request to /api/chat')

    // 1) Parse request body
    const body: ChatRequestBody = await req.json()
    const { messages, user_id, model_id, persona_id, files } = body
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 2) Extract the Authorization header from the request
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No valid Authorization header found')
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3) Forward request to FastAPI server with all parameters
    const externalApiUrl = `${getApiUrl()}/chatsse`
    console.log('Sending request to external API:', externalApiUrl)

    const lastMessage = messages[messages.length - 1]
    console.log('Last message:', JSON.stringify(lastMessage))
    console.log('Forwarding with params:', { user_id, model_id, persona_id, files })

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        message: lastMessage.content,
        messages: messages,
        user_id,
        model_id,
        persona_id,
        files,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('External API error:', response.statusText)
      console.error('External API error body:', errorBody)
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch from the chat API',
          details: errorBody,
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // 4) Stream the SSE response
    return new Response(response.body, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  } catch (error) {
    console.error('Error in chat route:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
