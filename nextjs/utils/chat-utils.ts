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
import { submitChatMessage } from './chat-service';

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
 * Copies content to the clipboard and updates copied states temporarily
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
    console.error('Failed to copy text:', err);
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
 * Returns a reset object with the initial model selections based on the chat mode
 */
export const resetSelectedModels = (mode: ChatMode, allChatModels: ChatModel[] | undefined): { [key: string]: string } => {
  // Handle case when models are undefined
  if (!allChatModels || allChatModels.length === 0) {
    return { chat1: '' };
  }

  // First, sort models by position (null positions go to the end)
  const sortedModels = [...allChatModels].sort((a, b) => {
    // If both have position values, compare them
    if (a.position !== undefined && a.position !== null && b.position !== undefined && b.position !== null) {
      return a.position - b.position;
    }
    // If only a has position, a comes first
    if (a.position !== undefined && a.position !== null) {
      return -1;
    }
    // If only b has position, b comes first
    if (b.position !== undefined && b.position !== null) {
      return 1;
    }
    // If neither has position, maintain original order
    return 0;
  });

  // Get the first 4 positioned models (or fewer if not enough)
  const firstFourModels = sortedModels.slice(0, 4);
  
  // Fallback to traditional selections if we didn't get positioned models
  const explicitDefaultModel = allChatModels.find(model => model.default === true);
  
  // Find default models based on providers if no explicit default is set
  const defaultOpenAIModel = explicitDefaultModel?.id || allChatModels.find(model => 
    model.provider === 'openai' && model.name.includes('4'))?.id || allChatModels[0]?.id;
  
  const defaultAnthropicModel = allChatModels.find(model => 
    model.provider === 'anthropic')?.id || allChatModels[1]?.id;
  
  const defaultGeminiModel = allChatModels.find(model => 
    model.provider === 'google')?.id || allChatModels[2]?.id;
  
  const defaultMetaModel = allChatModels.find(model => 
    model.provider === 'meta')?.id || allChatModels[3]?.id;

  // Use positioned models if available, otherwise fall back to provider-based defaults
  const model1 = firstFourModels[0]?.id || explicitDefaultModel?.id || defaultOpenAIModel || allChatModels[0]?.id || '';
  const model2 = firstFourModels[1]?.id || defaultAnthropicModel || allChatModels[1]?.id || '';
  const model3 = firstFourModels[2]?.id || defaultGeminiModel || allChatModels[2]?.id || '';
  const model4 = firstFourModels[3]?.id || defaultMetaModel || allChatModels[3]?.id || '';

  switch (mode) {
    case 'single':
      return { chat1: model1 };
    case 'dual':
      return { 
        chat1: model1,
        chat2: model2
      };
    case 'quad':
      return {
        chat1: model1,
        chat2: model2,
        chat3: model3,
        chat4: model4
      };
    default:
      return { chat1: model1 };
  }
};

/**
 * Makes an API call to the chat endpoint with enhanced chunk buffering
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
    isWebSearchEnabled,
    mode = 'single',
    activeStreamsRef
  } = params;

  // Don't allow more than one retry per chat window
  if (isRetry) {
    const currentRetries = retryAttempts[chatId] || 0;
    if (currentRetries > 0) {
      console.log(`Already retried chat ${chatId}, skipping further retries`);
      return;
    }
    setRetryAttempts(prev => ({
      ...prev,
      [chatId]: (prev[chatId] || 0) + 1
    }));
  }

  try {
    isStreamingRef.current = true;
    
    // Add this chat to active streams if in multi-chat mode
    if (mode !== 'single' && activeStreamsRef?.current) {
      activeStreamsRef.current.add(chatId);
    }
    
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

    // Get authentication headers
    const headers = await getApiHeaders();
    if (!headers) {
      throw new Error('Unable to get authentication headers');
    }

    // Use the submitChatMessage function from chat-service.ts
    const response = await submitChatMessage({
      messages: [...prevMessagesLocal, newMessage],
      userId: session?.user?.id,
      modelId: selectedModel?.id,
      personaId: selectedPersona?.id,
      files: uploadedFiles.map(f => ({ name: f.name, url: f.uploadURL })),
      conversationId: currentConversationId,
      multiConversationId: currentMultiConversationId,
      knowledgeBaseIds: selectedKnowledgeBases.map(kb => kb.id),
      assetIds: selectedAssets.map(asset => asset.id),
      webSearch: isWebSearchEnabled,
      headers
    });

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let assistantMessage = '';
    let hasCreatedAssistantMessage = false;
    
    // Buffer for incomplete chunks
    let buffer = '';
    let incompleteDataLine = '';

    streamStartTime = Date.now();

    while (true) {
      const timeElapsed = Date.now() - streamStartTime;
      if (timeElapsed > 10000 && (!receivedFirstChunk || (chunkCount === 1 && !hasReceivedContent))) {
        throw new Error('Stream timeout - no meaningful content received within 10 seconds');
      }

      const { value, done } = await reader.read();
      if (done) {
        // Process any remaining buffer content
        if (incompleteDataLine.trim()) {
          console.warn('Stream ended with incomplete data line:', incompleteDataLine);
        }
        
        if (chunkCount > 0 && !hasReceivedContent) {
          throw new Error('Stream completed with only empty chunks');
        }
        
        // Handle stream completion
        if (mode !== 'single' && activeStreamsRef?.current) {
          activeStreamsRef.current.delete(chatId);
          if (activeStreamsRef.current.size === 0) {
            isStreamingRef.current = false;
            if (chatContainerRef.current) {
              chatContainerRef.current.style.overflowY = 'auto';
            }
          }
        } else {
          isStreamingRef.current = false;
          if (chatContainerRef.current) {
            chatContainerRef.current.style.overflowY = 'auto';
          }
        }
        break;
      }

      if (!receivedFirstChunk) {
        receivedFirstChunk = true;
      }

      // Decode the chunk and add to buffer
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Split by newlines but keep track of incomplete lines
      const lines = buffer.split('\n');
      
      // The last "line" might be incomplete, so keep it in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        // Handle incomplete data lines from previous chunks
        const fullLine = incompleteDataLine + line;
        incompleteDataLine = '';

        if (!fullLine.startsWith('data: ')) {
          continue;
        }

        chunkCount++;
        const jsonData = fullLine.slice(5).trim();
        
        if (jsonData === '[DONE]') {
          continue;
        }

        if (!jsonData) {
          continue;
        }

        try {
          // First, try to parse the JSON
          const parsed = JSON.parse(jsonData);
          
          // Process the parsed data
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
          // If JSON parsing fails, this might be an incomplete chunk
          // Check if it looks like the start of valid JSON
          if (jsonData.startsWith('{') && !jsonData.endsWith('}')) {
            // This looks like an incomplete JSON object, save it for the next iteration
            incompleteDataLine = fullLine;
            console.debug('Buffering incomplete JSON for next chunk');
          } else {
            // This is genuinely malformed JSON
            console.warn('Malformed JSON chunk:', jsonData);
            console.warn('Parse error:', parseError);
          }
        }
      }
    }
  } catch (err: any) {
    // Clean up streaming state
    if (mode !== 'single' && activeStreamsRef?.current) {
      activeStreamsRef.current.delete(chatId);
      if (activeStreamsRef.current.size === 0) {
        isStreamingRef.current = false;
        if (chatContainerRef.current) {
          chatContainerRef.current.style.overflowY = 'auto';
        }
      }
    } else {
      isStreamingRef.current = false;
      if (chatContainerRef.current) {
        chatContainerRef.current.style.overflowY = 'auto';
      }
    }
    
    console.error('Error in API call:', err);

    // Retry logic
    if ((err.message.includes('timeout') || err.message.includes('empty chunk')) && !isRetry) {
      console.log('Retrying stream without specific model for', chatId);
      try {
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

/**
 * Add conversation to scratch pad
 * @param content Content to add to the scratch pad
 */
export const addToScratchPad = async (content: string) => {
  try {
    const { addToScratchPad: addToScratchPadService } = await import('./scratch-pad-service');
    await addToScratchPadService(content);
  } catch (err) {
    console.error('Failed to add to scratch pad:', err);
  }
};

/**
 * Handles a prompt selection, adding it to the input or showing complex prompt modal
 * @param prompt The selected prompt
 * @param setSelectedComplexPrompt State setter for the selected complex prompt
 * @param setInput State setter for the input field
 */
export const handlePromptSelect = (
  prompt: any,
  setSelectedComplexPrompt: React.Dispatch<React.SetStateAction<any | null>>,
  setInput: React.Dispatch<React.SetStateAction<string>>
) => {
  if (prompt.is_complex) {
    setSelectedComplexPrompt(prompt);
  } else {
    setInput(prevInput => {
      const prefix = prevInput ? prevInput + ' ' : '';
      const promptText = typeof prompt.prompt === 'string' ? prompt.prompt : '';
      return prefix + promptText;
    });
  }
};

/**
 * Handles complex prompt submission, adding the generated prompt to the input
 * @param generatedPrompt The generated prompt text
 * @param setInput State setter for the input field
 * @param setSelectedComplexPrompt State setter for the selected complex prompt
 */
export const handleComplexPromptSubmit = (
  generatedPrompt: string,
  setInput: React.Dispatch<React.SetStateAction<string>>,
  setSelectedComplexPrompt: React.Dispatch<React.SetStateAction<any | null>>
) => {
  setInput(prevInput => (prevInput ? prevInput + ' ' : '') + generatedPrompt);
  setSelectedComplexPrompt(null);
};

/**
 * Handles mode change, updating models and resetting conversation tracking
 * @param newMode The new chat mode
 * @param setMode State setter for the chat mode
 * @param allChatModels Available chat models
 * @param setSelectedModels State setter for selected models
 * @param resetRetryAttempts Function to reset retry attempts
 * @param setMultiConversationId State setter for multi-conversation ID
 */
export const handleModeChange = (
  newMode: ChatMode,
  setMode: React.Dispatch<React.SetStateAction<ChatMode>>,
  allChatModels: ChatModel[] | undefined,
  setSelectedModels: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>,
  resetRetryAttemptsState: () => void,
  setMultiConversationId: React.Dispatch<React.SetStateAction<string | null>>
) => {
  setMode(newMode);
  
  // Update models based on the new mode
  setSelectedModels(resetSelectedModels(newMode, allChatModels));

  // Reset retry attempts and multi-conversation tracking
  resetRetryAttemptsState();
  setMultiConversationId(null);
};

/**
 * Handles toggling between different chatbot models
 * @param modelId The model ID to switch to
 * @param router Next.js router
 * @param setSelectedModels State setter for selected models
 * @param allChatModels All available chat models
 */
export const handleToggleChatbot = (
  modelId: string,
  router: any,
  setSelectedModels: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>,
  allChatModels?: ChatModel[]
) => {
  // Find the selected model
  const selectedModel = allChatModels?.find(m => m.id === modelId);
  console.log('Switching to model:', {
    id: selectedModel?.id,
    name: selectedModel?.name,
    position: selectedModel?.position,
    provider: selectedModel?.provider
  });
  
  // Update the URL
  router.push(`/chat?model=${modelId}`, { scroll: false });
  // Update the selected model
  setSelectedModels(prev => ({
    ...prev,
    chat1: modelId
  }));
};
