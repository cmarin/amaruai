// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { getApiUrl } from '@/utils/api-utils'

export const runtime = 'edge'

// We'll define the shape of your request body:
interface ChatRequestBody {
  messages?: Array<{ role: string; content: string }>
  // plus any other fields like model_id, persona_id, etc. if you want
}

export async function POST(req: NextRequest) {
  console.log('Received POST request to /api/chat')

  try {
    // 1. Parse the request body
    const body: ChatRequestBody = await req.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('Invalid or empty messages array')
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 2. Grab the session from Supabase
    //    (We pass the request + a NextResponse to createMiddlewareClient)
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req, res })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // 3. If the user is not logged in, we can either respond 401 or let them continue
    if (!session?.access_token) {
      console.error('No access token found in session')
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const lastMessage = messages[messages.length - 1]
    console.log('Last message:', JSON.stringify(lastMessage))

    // 4. Construct the external SSE URL
    const externalApiUrl = `${getApiUrl()}/chatsse`
    console.log('Sending request to external API:', externalApiUrl)

    // 5. Forward the user’s token via Authorization: Bearer
    //    Also pass any other fields (model_id, persona_id, files, etc.) that you need.
    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // This is critical: forward the user's access token
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        // pass your entire request or just the pieces you need
        message: lastMessage.content,
        // or if you need the entire messages array, do this:
        // messages: messages,
        // model_id: body.model_id, persona_id: body.persona_id, files, etc...
      }),
    })

    if (!response.ok) {
      console.error('External API error:', response.statusText)
      const errorBody = await response.text()
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

    // 6. Stream the SSE response back to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    })
  } catch (error) {
    console.error(
      'Error in chat route:',
      error instanceof Error ? error.message : String(error)
    )
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
