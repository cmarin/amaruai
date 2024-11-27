import { v4 as uuidv4 } from 'uuid';
import { ChatModel } from './chatModelService';
import { Persona } from './personaService';
import { getApiUrl, getFetchOptions } from '@/lib/apiConfig';
import { fetchWithRetry } from './apiUtils';
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

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

export interface ChatServiceCallbacks {
    onUpdateChatbots: (updater: (prevBots: ChatBot[]) => ChatBot[]) => void;
    onSetChatLoading: (botId: string, loading: boolean) => void;
    getApiHeaders: () => HeadersInit | null;
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
        let assistantMessage = '';

        try {
            const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
                if (event.type === 'event') {
                    const data = event.data;
                    if (data === '[DONE]') {
                        return;
                    }
                    assistantMessage += data;
                    onChunk(assistantMessage);
                }
            });

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                parser.feed(chunk);
            }
        } catch (error) {
            onError(error instanceof Error ? error : new Error('Unknown error occurred'));
        }
    }

    static async handleSend(
        input: string,
        chatbots: ChatBot[],
        activeChatbots: string[],
        personas: Persona[],
        allModels: ChatModel[],
        callbacks: ChatServiceCallbacks
    ): Promise<void> {
        if (!input.trim()) return;

        const newMessage: Message = { role: 'user', content: input };
        callbacks.onUpdateChatbots(prevBots => 
            this.addMessageToChatBots(prevBots, activeChatbots, newMessage)
        );

        for (const botId of activeChatbots) {
            const bot = chatbots.find(b => b.id === botId);
            if (bot) {
                callbacks.onSetChatLoading(botId, true);

                try {
                    const headers = callbacks.getApiHeaders();
                    if (!headers) {
                        console.error('No valid headers available');
                        return;
                    }

                    const response = await this.sendChatMessage(
                        bot,
                        input,
                        personas,
                        allModels,
                        headers
                    );

                    // Initialize assistant's response
                    callbacks.onUpdateChatbots(prevBots => prevBots.map(b => 
                        b.id === botId
                            ? { ...b, messages: [...b.messages, { role: 'assistant', content: '' }] }
                            : b
                    ));

                    // Process the streamed response
                    await this.processStreamedResponse(
                        response,
                        (content) => {
                            callbacks.onUpdateChatbots(prevBots => {
                                return prevBots.map(b => {
                                    if (b.id === botId) {
                                        const lastMessage = b.messages[b.messages.length - 1];
                                        if (lastMessage && lastMessage.role === 'assistant') {
                                            return {
                                                ...b,
                                                messages: [
                                                    ...b.messages.slice(0, -1),
                                                    { ...lastMessage, content }
                                                ]
                                            };
                                        }
                                    }
                                    return b;
                                });
                            });
                        },
                        (error) => {
                            console.error('Error processing stream:', error);
                            callbacks.onSetChatLoading(botId, false);
                        }
                    );
                } catch (error) {
                    console.error('Error sending message:', error);
                    callbacks.onUpdateChatbots(prevBots => prevBots.map(b =>
                        b.id === botId
                            ? { ...b, messages: [...b.messages, { role: 'assistant', content: 'An error occurred while processing your request. Please try again.' }] }
                            : b
                    ));
                } finally {
                    callbacks.onSetChatLoading(botId, false);
                }
            }
        }
    }
}
