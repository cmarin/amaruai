import { NextRequest } from 'next/server'
import { getApiUrl } from '@/utils/api-utils'

export const runtime = 'edge'

interface BatchFlowRequestBody {
  file_ids: string[]
  knowledge_base_ids?: string[]
  asset_ids?: string[]
  steps: Array<{
    prompt_template_id: string
    chat_model_id: string
    persona_id: string
  }>
  customInstructions?: string
}

export async function POST(req: NextRequest) {
  try {
    console.log('Received POST request to /api/batch-flow')

    // 1) Parse request body
    const body: BatchFlowRequestBody = await req.json()
    const { file_ids, knowledge_base_ids, asset_ids, steps, customInstructions } = body

    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid file_ids' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid steps' }), {
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
    const externalApiUrl = `${getApiUrl()}/batch-flow`
    console.log('Sending request to external API:', externalApiUrl)

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
          file_ids,
          knowledge_base_ids,
          asset_ids,
          steps,
          customInstructions
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('External API error:', response.statusText)
      console.error('External API error body:', errorBody)
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch from the batch flow API',
          details: errorBody,
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // 4) Stream the SSE response
    const transformedBody = response.body || new ReadableStream()
    return new Response(transformedBody, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  } catch (error) {
    console.error('Error in batch flow route:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
