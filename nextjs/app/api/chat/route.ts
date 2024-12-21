import { Message } from 'ai';
import { getApiUrl } from '@/utils/api-utils';
import type { ApiHeaders } from '@/utils/session/session';
export const runtime = 'edge';

export async function POST(req: Request) {
  console.log('Received POST request to /api/chat');
  
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('Invalid or empty messages array');
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const lastMessage = messages[messages.length - 1];
    console.log('Last message:', JSON.stringify(lastMessage));

    const externalApiUrl = `${getApiUrl()}/chatsse`;
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
      return new Response(JSON.stringify({ error: 'Failed to fetch from the chat API', details: errorBody }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the response
    return new Response(response.body, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Error in chat route:', error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}