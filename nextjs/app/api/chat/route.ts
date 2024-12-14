import { NextRequest, NextResponse } from 'next/server';
import { getApiUrl } from '@/utils/api-utils';
import type { ApiHeaders } from '@/utils/session/session';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  console.log('Received POST request to /api/chat');
  
  try {
    // Get authorization headers from incoming request
    const authHeader = req.headers.get('authorization');
    
    const headers: ApiHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader || ''
    };

    const body = await req.json();
    const { messages, modelId, persona } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('Invalid or empty messages array');
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    console.log('Last message:', JSON.stringify(lastMessage));

    const externalApiUrl = `${getApiUrl()}/chatsse`;
    console.log('Sending request to external API:', externalApiUrl);

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: lastMessage.content,
        modelId,
        persona,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      }),
    });

    if (!response.ok) {
      console.error('External API error:', response.statusText);
      const errorBody = await response.text();
      console.error('External API error body:', errorBody);
      return NextResponse.json({ error: 'Failed to fetch from the chat API', details: errorBody }, { status: response.status });
    }

    // Create a TransformStream to convert the response into the format expected by the Vercel AI SDK
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              // Format the data according to Vercel AI SDK expectations
              const aiMessage = {
                id: data.id || Date.now().toString(),
                role: 'assistant',
                content: data.choices?.[0]?.delta?.content || '',
                createdAt: new Date().toISOString()
              };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(aiMessage)}\n\n`));
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    });

    return new NextResponse(response.body?.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Unexpected error in API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'An unexpected error occurred', details: errorMessage }, { status: 500 });
  }
}
