import { v4 as uuidv4 } from 'uuid';
import { ChatModel } from './chat-model-service';
import { Persona } from './persona-service';
import { getApiUrl, getFetchOptions, fetchWithRetry } from './api-utils';
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

    static async sendChatMessageWithRetry(
        bot: ChatBot,
        message: string,
        personas: Persona[],
        allModels: ChatModel[],
        headers: HeadersInit,
        userId: string = 'test',
        maxRetries: number = 2
    ): Promise<Response> {
        let lastError: Error | null = null;
        let currentModel = bot.apiName;
        const defaultModel = allModels[0].model;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const payload: ChatPayload = {
                    user_id: userId,
                    conversation_id: bot.conversationId,
                    message: message,
                };

                console.log('Sending chat request with payload:', {
                    user_id: payload.user_id,
                    conversation_id: payload.conversation_id,
                    model: currentModel
                });

                const personaObject = personas.find(p => p.role === bot.persona);
                if (personaObject) {
                    payload.persona_id = Number(personaObject.id);
                }

                // On final retry, use default model if we had a provider error
                const isProviderError = lastError instanceof Error && 
                    (lastError.message === 'Provider returned error' || lastError.message.includes('Provider returned error'));
                
                if (attempt === maxRetries - 1 && isProviderError) {
                    currentModel = defaultModel;
                    console.log(`Final retry: Switching to default model ${defaultModel} for bot ${bot.name}`);
                    // Don't include model in payload for default model
                } else {
                    if (attempt > 0) {
                        console.log(`Retry attempt ${attempt + 1}/${maxRetries}: Using model ${currentModel} for bot ${bot.name}`);
                    }
                    // Only include model if it's not the default model
                    if (currentModel !== defaultModel) {
                        payload.model = currentModel;
                    }
                }

                const response = await fetchWithRetry(async () => {
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

                return response;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error occurred');
                console.error(`Chat attempt ${attempt + 1} failed for model ${currentModel} (bot: ${bot.name}):`, lastError.message);
                
                // Only continue retrying for provider errors
                if (!(lastError.message === 'Provider returned error' || lastError.message.includes('Provider returned error'))) {
                    throw lastError;
                }
            }
        }

        throw lastError;
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

                    // Check for error message format
                    if (data.startsWith('Error:') || data.includes('Provider returned error')) {
                        throw new Error(data);
                    }

                    // Preserve line breaks by replacing them with HTML line breaks
                    const formattedData = data
                        .replace(/\n\n+/g, '\n\n')  // Normalize multiple line breaks to double
                        .replace(/\n\n/g, '\n\n');  // Preserve double line breaks

                    assistantMessage += formattedData;
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
            const e = error instanceof Error ? error : new Error('Unknown error occurred');
            console.error('Stream processing error:', e.message);
            onError(e);
        }
    }

    static async handleSend(
        input: string,
        chatbots: ChatBot[],
        activeChatbots: string[],
        personas: Persona[],
        allModels: ChatModel[],
        callbacks: ChatServiceCallbacks,
        userId?: string
    ): Promise<void> {
        if (!input.trim()) return;

        console.log('handleSend called with userId:', userId);

        const newMessage: Message = { role: 'user', content: input };
        callbacks.onUpdateChatbots(prevBots => 
            this.addMessageToChatBots(prevBots, activeChatbots, newMessage)
        );

        const headers = callbacks.getApiHeaders();
        if (!headers) {
            console.error('No valid headers available');
            return;
        }

        const chatPromises = activeChatbots.map(async (botId) => {
            const bot = chatbots.find(b => b.id === botId);
            if (!bot) return;

            callbacks.onSetChatLoading(botId, true);

            try {
                const response = await this.sendChatMessageWithRetry(
                    bot,
                    input,
                    personas,
                    allModels,
                    headers,
                    userId
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
        });

        await Promise.all(chatPromises);
    }
}
