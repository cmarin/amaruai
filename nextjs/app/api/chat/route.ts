import { NextRequest, NextResponse } from 'next/server';
import { getApiUrl } from '@/utils/api-utils';
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  console.log('Received POST request to /api/chat');
  
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('Invalid or empty messages array');
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    console.log('Last message:', JSON.stringify(lastMessage));

    //const externalApiUrl = 'https://ssestream.replit.app/chat';
    const externalApiUrl =  `${getApiUrl()}/chatsse`
    console.log('Sending request to external API:', externalApiUrl);

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: lastMessage.content }),
    });

    if (!response.ok) {
      console.error('External API error:', response.statusText);
      const errorBody = await response.text();
      console.error('External API error body:', errorBody);
      return NextResponse.json({ error: 'Failed to fetch from the chat API', details: errorBody }, { status: response.status });
    }

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Unexpected error in API route:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
}

