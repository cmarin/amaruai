import { NextRequest } from 'next/server'
import { getApiUrl } from '@/utils/api-utils'

export const runtime = 'edge'

interface WorkflowExecuteRequestBody {
  user_id: string
  conversation_id: string
  knowledge_base_ids?: string[]
  asset_ids?: string[]
  message?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: { workflow_id: string } }
) {
  try {
    console.log('Received POST request to /api/workflows/[workflow_id]/execute')

    // 1) Parse request body
    const body: WorkflowExecuteRequestBody = await req.json()
    const { user_id, conversation_id, knowledge_base_ids, asset_ids, message } = body

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
    const externalApiUrl = `${getApiUrl()}/workflows/${params.workflow_id}/execute`

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        user_id,
        conversation_id,
        knowledge_base_ids,
        asset_ids,
        message,
      }),
    })

    // 4) Return the response from the FastAPI server
    const data = await response.json()

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error in workflow execution:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}