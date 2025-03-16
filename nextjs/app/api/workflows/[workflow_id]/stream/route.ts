import { NextRequest } from 'next/server'
import { getApiUrl } from '@/utils/api-utils'

export const runtime = 'edge'

interface WorkflowStreamRequestBody {
  user_id: string
  conversation_id: string
  message?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: { workflow_id: string } }
) {
  try {
    console.log('Received POST request to /api/workflows/[workflow_id]/stream')

    // 1) Parse request body
    const body: WorkflowStreamRequestBody = await req.json()
    const { user_id, conversation_id, message } = body

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Invalid user_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: 'Invalid conversation_id' }), {
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

    // 3) Forward request to FastAPI server
    const externalApiUrl = `${getApiUrl()}/workflows/${params.workflow_id}/stream`
    console.log('Forwarding request to:', externalApiUrl)

    const payload = {
      user_id,
      conversation_id,
      ...(message && { message })
    }

    console.log('Request payload:', payload)

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error from FastAPI server:', errorText)
      return new Response(JSON.stringify({ error: `Error from API server: ${response.status} ${response.statusText}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 4) Return the stream token
    const data = await response.json()
    return new Response(JSON.stringify({ stream_token: data.stream_token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in workflow stream API route:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { workflow_id: string } }
) {
  try {
    console.log('Received GET request to /api/workflows/[workflow_id]/stream')
    
    // Get the stream token from the query parameters
    const url = new URL(req.url)
    const streamToken = url.searchParams.get('stream_token')
    
    if (!streamToken) {
      return new Response(JSON.stringify({ error: 'Missing stream_token parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Extract the Authorization header from the request
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No valid Authorization header found')
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Forward request to FastAPI server
    const externalApiUrl = `${getApiUrl()}/workflows/${params.workflow_id}/stream?stream_token=${streamToken}`
    console.log('Forwarding stream request to:', externalApiUrl)

    const response = await fetch(externalApiUrl, {
      headers: {
        'Authorization': authHeader
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error from FastAPI server:', errorText)
      return new Response(JSON.stringify({ error: `Error from API server: ${response.status} ${response.statusText}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create a TransformStream to proxy the SSE events
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    
    // Process the response body as a stream of SSE events
    const reader = response.body?.getReader()
    if (!reader) {
      return new Response(JSON.stringify({ error: 'Failed to read stream from API server' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Start reading the stream
    const processStream = async () => {
      try {
        const decoder = new TextDecoder()
        let buffer = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          // Decode the chunk and add it to our buffer
          buffer += decoder.decode(value, { stream: true })
          
          // Process complete SSE events in the buffer
          const events = buffer.split('\n\n')
          buffer = events.pop() || '' // Keep the last incomplete event in the buffer
          
          // Forward each complete event
          for (const event of events) {
            if (event.trim()) {
              await writer.write(new TextEncoder().encode(event + '\n\n'))
            }
          }
        }
        
        // Process any remaining data
        if (buffer.trim()) {
          await writer.write(new TextEncoder().encode(buffer))
        }
        
        await writer.close()
      } catch (error) {
        console.error('Error processing stream:', error)
        await writer.abort(error as Error)
      }
    }
    
    // Start processing in the background
    processStream()
    
    // Return the readable side of the transform stream
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('Error in workflow stream GET API route:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
} 