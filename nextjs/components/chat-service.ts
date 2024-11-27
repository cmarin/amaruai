import { v4 as uuidv4 } from 'uuid';
import { ChatModel } from './chatModelService';
import { Persona } from './personaService';
import { getApiUrl, getFetchOptions } from '@/lib/apiConfig';
import { fetchWithRetry } from './apiUtils';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatBot {
    id: string;
    name: string;
    apiName: string;
    messages: Message[];
    persona: string;
    conversationId: string;
    selectedModelId: string;
}

export interface ChatPayload {
    user_id: string;
    conversation_id: string;
    message: string;
    model?: string;
    persona_id?: number;
}

export class ChatService {
    static createChatBot(model: ChatModel): ChatBot {
        return {
            id: model.id.toString(),
            name: model.name,
            apiName: model.model,
            messages: [],
            persona: 'default',
            conversationId: uuidv4(),
            selectedModelId: model.id.toString()
        };
    }

    static createInitialChatBots(chatModels: ChatModel[]): ChatBot[] {
        return chatModels.map(model => ChatService.createChatBot(model));
    }

    static addMessageToChatBots(chatbots: ChatBot[], activeChatbots: string[], message: Message): ChatBot[] {
        return chatbots.map(bot => 
            activeChatbots.includes(bot.id) 
                ? { ...bot, messages: [...bot.messages, message] }
                : bot
        );
    }

    static async sendChatMessage(
        bot: ChatBot,
        message: string,
        personas: Persona[],
        allModels: ChatModel[],
        headers: HeadersInit
    ): Promise<Response> {
        const personaObject = personas.find(p => p.role === bot.persona);

        const payload: ChatPayload = {
            //TODO remove user_id
            user_id: "test",
            conversation_id: bot.conversationId,
            message: message,
        };

        if (bot.apiName !== allModels[0].model) {
            payload.model = bot.apiName;
        }

        if (personaObject) {
            payload.persona_id = personaObject.id;
        }

        return await fetchWithRetry(async () => {
            const res = await fetch(`${getApiUrl()}/chat`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                ...getFetchOptions(),
            });
            
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            
            return res;
        });
    }

    static async processStreamedResponse(
        response: Response,
        onChunk: (chunk: string) => void,
        onError: (error: Error) => void
    ): Promise<void> {
        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\\n');
                
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        onChunk(data);
                    }
                }
            }
            
            if (buffer) {
                const lines = buffer.split('\\n');
                for (const line of lines) {
                    if (line.trim() === '' || !line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    onChunk(data);
                }
            }
        } catch (error) {
            onError(error instanceof Error ? error : new Error('Unknown error occurred'));
        }
    }
}
