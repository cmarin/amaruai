// app/api/chat/route.ts
import { NextRequest } from 'next/server'
import { getApiUrl } from '@/utils/api-utils'

export const runtime = 'edge'

interface ChatRequestBody {
  messages?: Array<{ role: string; content: string }>
  // also accept other fields (model_id, persona_id, etc.) if you want
}

export async function POST(req: NextRequest) {
  try {
    console.log('Received POST request to /api/chat')

    // 1) Parse request body
    const body: ChatRequestBody = await req.json()
    const { messages } = body
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

    // 3) Forward that same token to your FastAPI server
    const externalApiUrl = `${getApiUrl()}/chatsse`
    console.log('Sending request to external API:', externalApiUrl)

    // Use the last message as you did before
    const lastMessage = messages[messages.length - 1]
    console.log('Last message:', JSON.stringify(lastMessage))

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // <-- forward the same Bearer token -->
        Authorization: authHeader,
      },
      body: JSON.stringify({
        // Pass anything your FastAPI server expects
        message: lastMessage.content,
        // or the entire array: messages
        // plus model_id, persona_id, etc. if needed
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
