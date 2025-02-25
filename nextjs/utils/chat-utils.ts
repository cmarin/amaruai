import { 
  Message, 
  ApiCallParams,
  ChatMode
} from '@/types/chat';
import { ChatModel } from '@/components/data-context';
import { 
  MessageSquare, 
  Bot, 
  Timer, 
  Sparkles, 
  SmilePlus
} from 'lucide-react';
import { OpenAIIcon, AnthropicIcon, GeminiIcon, PerplexityIcon, MistralIcon, MetaIcon, ZephyrIcon } from '@/components/icons/ai-provider-icons';

/**
 * Determines if a scrollable container is at the bottom (within a threshold)
 */
export const isAtBottom = (containerRef: HTMLElement): boolean => {
  const threshold = 100; // pixels from bottom
  const position = containerRef.scrollTop + containerRef.clientHeight;
  const height = containerRef.scrollHeight;
  return height - position <= threshold;
};

/**
 * Maintains scroll position based on whether we were at the bottom before
 */
export const maintainScroll = (containerRef: HTMLElement, wasAtBottom: boolean): void => {
  if (!containerRef) return;
  
  // If we were at the bottom before the update, scroll to bottom
  if (wasAtBottom) {
    containerRef.scrollTop = containerRef.scrollHeight;
  }
};

/**
 * Gets the appropriate icon for an AI provider based on the model name
 */
export const getProviderIcon = (modelId: string, modelName: string) => {
  const nameLower = modelName.toLowerCase();
  
  if (nameLower.includes('gpt') || nameLower.includes('o1')) return OpenAIIcon;
  if (nameLower.includes('claude')) return AnthropicIcon;
  if (nameLower.includes('gemini')) return GeminiIcon;
  if (nameLower.includes('perplexity')) return PerplexityIcon;
  if (nameLower.includes('mistral') || nameLower.includes('mixtral')) return MistralIcon;
  if (nameLower.includes('llama')) return MetaIcon;
  if (nameLower.includes('zephyr')) return ZephyrIcon;
  return MessageSquare as React.ComponentType<any>;
};

/**
 * Copies text to clipboard and updates copy state
 */
export const copyToClipboard = async (
  content: string,
  setCopiedStates: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>
): Promise<void> => {
  try {
    await navigator.clipboard.writeText(content);
    setCopiedStates(prev => ({ ...prev, [content]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [content]: false }));
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

/**
 * Gets the model name for a chat window
 */
export const getModelName = (
  chatWindowId: string,
  selectedModels: { [key: string]: string },
  allChatModels?: ChatModel[]
): string => {
  const modelId = selectedModels[chatWindowId];
  const model = allChatModels?.find(m => m.id === modelId);
  return model?.name || "Default Model";
};

/**
 * Gets the model icon for a chat window
 */
export const getModelIcon = (
  chatWindowId: string,
  selectedModels: { [key: string]: string },
  allChatModels?: ChatModel[]
): React.ComponentType<any> => {
  const modelId = selectedModels[chatWindowId];
  const model = allChatModels?.find(m => m.id === modelId);
  return model ? getProviderIcon(model.id, model.name) : Timer;
};

/**
 * Resets selected models when changing display mode
 */
export const resetSelectedModels = (
  mode: ChatMode,
  allChatModels?: ChatModel[]
): { [key: string]: string } => {
  // Find default and other models
  const defaultModel = allChatModels?.find(model => model.default);
  const otherModels = allChatModels
    ?.filter(model => !model.default && model.id !== defaultModel?.id)
    .slice(0, 3);

  if (!defaultModel) return { chat1: '' };

  // Always keep chat1 as default model
  const newModelSelections: { [key: string]: string } = {
    chat1: defaultModel.id,
  };

  // Add other models based on mode
  if (mode !== 'single' && otherModels?.[0]) {
    newModelSelections.chat2 = otherModels[0].id;
  }
  if (mode === 'quad') {
    if (otherModels?.[1]) newModelSelections.chat3 = otherModels[1].id;
    if (otherModels?.[2]) newModelSelections.chat4 = otherModels[2].id;
  }

  return newModelSelections;
};

/**
 * Makes an API call to the chat endpoint
 */
export const makeApiCall = async (params: ApiCallParams): Promise<void> => {
  const {
    prevMessagesLocal,
    setMessagesFunction,
    chatId,
    isRetry = false,
    newMessage,
    session,
    getApiHeaders,
    uploadedFiles,
    selectedModels,
    selectedPersonas,
    conversationIds,
    setConversationIds,
    currentMultiConversationId,
    retryAttempts,
    setRetryAttempts,
    setError,
    isStreamingRef,
    chatContainerRef,
    selectedKnowledgeBases,
    selectedAssets,
    allChatModels,
    personas,
    isWebSearchEnabled
  } = params;

  // Don't allow more than one retry per chat window
  if (isRetry) {
    const currentRetries = retryAttempts[chatId] || 0;
    if (currentRetries > 0) {
      console.log(`Already retried chat ${chatId}, skipping further retries`);
      return;
    }
    // Mark this chat window as having been retried
    setRetryAttempts(prev => ({
      ...prev,
      [chatId]: (prev[chatId] || 0) + 1
    }));
  }

  try {
    isStreamingRef.current = true;
    // Get or create conversation_id for this chat window
    let currentConversationId = conversationIds[chatId];
    if (!currentConversationId) {
      currentConversationId = crypto.randomUUID();
      setConversationIds(prev => ({
        ...prev,
        [chatId]: currentConversationId
      }));
    }

    // Get the selected model and persona for this chat
    const modelId = isRetry ? undefined : (selectedModels[chatId] || allChatModels?.[0]?.id);
    const personaId = selectedPersonas[chatId];
    const selectedModel = modelId ? allChatModels?.find(model => model.id === modelId) : undefined;
    const selectedPersona = personas?.find(p => p.id.toString() === personaId);

    let streamStartTime: number | null = null;
    let receivedFirstChunk = false;
    let hasReceivedContent = false;
    let chunkCount = 0;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getApiHeaders(),
      },
      body: JSON.stringify({ 
        messages: [...prevMessagesLocal, newMessage],
        user_id: session?.user?.id,
        model_id: selectedModel?.id,
        persona_id: selectedPersona?.id,
        files: uploadedFiles.map(f => ({ name: f.name, url: f.uploadURL })),
        conversation_id: currentConversationId,
        knowledge_base_ids: selectedKnowledgeBases.map(kb => kb.id),
        asset_ids: selectedAssets.map(asset => asset.id),
        ...(currentMultiConversationId && { multi_conversation_id: currentMultiConversationId }),
        web: isWebSearchEnabled
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let assistantMessage = '';
    let hasCreatedAssistantMessage = false;

    streamStartTime = Date.now();

    while (true) {
      const timeElapsed = Date.now() - streamStartTime;
      if (timeElapsed > 10000 && (!receivedFirstChunk || (chunkCount === 1 && !hasReceivedContent))) {
        throw new Error('Stream timeout - no meaningful content received within 10 seconds');
      }

      const { value, done } = await reader.read();
      if (done) {
        if (chunkCount > 0 && !hasReceivedContent) {
          throw new Error('Stream completed with only empty chunks');
        }
        isStreamingRef.current = false;
        if (chatContainerRef.current) {
          chatContainerRef.current.style.overflowY = 'auto';
        }
        break;
      }

      if (!receivedFirstChunk) {
        receivedFirstChunk = true;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          chunkCount++;
          const jsonData = line.slice(5).trim();
          if (jsonData === '[DONE]') continue;

          try {
            const jsonString = jsonData;
            const openBraces = (jsonString.match(/{/g) || []).length;
            const closeBraces = (jsonString.match(/}/g) || []).length;
            
            if (openBraces !== closeBraces || (openBraces > 0 && !jsonString.trim().endsWith('}'))) {
              console.warn('Skipping incomplete JSON chunk:', jsonString);
              continue;
            }

            const parsed = JSON.parse(jsonString);
            if (parsed.choices?.[0]?.delta?.content) {
              hasReceivedContent = true;
              assistantMessage += parsed.choices[0].delta.content;
              
              if (!hasCreatedAssistantMessage) {
                hasCreatedAssistantMessage = true;
                setMessagesFunction(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
              } else {
                setMessagesFunction(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: assistantMessage,
                  };
                  if (chatContainerRef.current) {
                    chatContainerRef.current.style.overflowY = 'auto';
                  }
                  return updated;
                });
              }
            }
          } catch (parseError) {
            console.warn('Error parsing chunk, skipping:', parseError);
            console.warn('Problematic chunk:', jsonData);
            continue;
          }
        }
      }
    }
  } catch (err: any) {
    isStreamingRef.current = false;
    if (chatContainerRef.current) {
      chatContainerRef.current.style.overflowY = 'auto';
    }
    console.error('Error in API call:', err);

    // If this is a timeout error or empty chunk error, retry without model_id
    if ((err.message.includes('timeout') || err.message.includes('empty chunk')) && !isRetry) {
      console.log('Retrying stream without specific model for', chatId);
      try {
        // Retry the API call without the model_id
        return makeApiCall({
          ...params,
          isRetry: true
        });
      } catch (retryErr) {
        console.error('Retry also failed:', retryErr);
        const errMsg = retryErr instanceof Error ? retryErr.message : 'Unknown error';
        setError(prevError =>
          prevError
            ? new Error(`${prevError.message}\nRetry failed: ${errMsg}`)
            : new Error(`Retry failed: ${errMsg}`)
        );
      }
    } else {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(prevError =>
        prevError
          ? new Error(`${prevError.message}\n${errMsg}`)
          : new Error(errMsg)
      );
    }
  }
}; 