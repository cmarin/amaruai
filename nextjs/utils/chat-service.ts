import { 
  Message, 
  ChatMode, 
  ApiCallParams, 
  ChatSubmitParams, 
  ApiResponse, 
  SubmitChatMessagesParams 
} from '@/types/chat';
import { ChatModel } from '@/components/data-context';
import type { UploadedFile } from '@/utils/upload-service';
import type { KnowledgeBase } from '@/utils/knowledge-base-service';
import type { Asset } from '@/types/knowledge-base';
import { makeApiCall } from './chat-utils';
import { MutableRefObject } from 'react';

/**
 * Submits a message to the chat API
 * 
 * @param params Parameters for the chat API
 * @param signal Optional AbortSignal for cancelling the request
 * @returns The API response
 */
export const submitChatMessage = async (
  params: ChatSubmitParams,
  signal?: AbortSignal
): Promise<Response> => {
  // Prepare headers by combining default headers with any provided authentication headers
  const headers = {
    'Content-Type': 'application/json',
    ...(params.headers || {})  // Include authentication headers if provided
  };

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: params.messages,
      user_id: params.userId,
      model_id: params.modelId,
      persona_id: params.personaId,
      files: params.files,
      conversation_id: params.conversationId,
      ...(params.multiConversationId && { multi_conversation_id: params.multiConversationId }),
      ...(params.knowledgeBaseIds?.length && { knowledge_base_ids: params.knowledgeBaseIds }),
      ...(params.assetIds?.length && { asset_ids: params.assetIds }),
      web: params.webSearch
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
};

/**
 * Prepares and submits chat messages to all relevant models
 * 
 * This is a higher-level function that prepares the chat messages for submission
 * based on the current state and chat mode.
 */
export const prepareChatSubmission = (
  mode: ChatMode,
  conversationIds: { [key: string]: string },
  multiConversationId: string | null,
  userInput: string,
  uploadedFiles: UploadedFile[],
  selectedModels: { [key: string]: string },
  selectedPersonas: { [key: string]: string },
  selectedKnowledgeBases: KnowledgeBase[],
  selectedAssets: Asset[],
  webSearch: boolean,
  allChatModels?: ChatModel[]
): {
  newMessage: Message;
  currentMultiConversationId: string | null;
  chatApiParams: Array<{chatId: string, apiParams: Partial<ChatSubmitParams>}>;
} => {
  // Create new user message
  const newMessage: Message = { 
    role: 'user', 
    content: userInput.trim() 
  };
  
  // Generate a new multi_conversation_id if in multi-chat mode and none exists
  let currentMultiConversationId = multiConversationId;
  if ((mode === 'dual' || mode === 'quad') && !currentMultiConversationId) {
    currentMultiConversationId = crypto.randomUUID();
  }

  // Prepare common parameters for all API calls
  const chatParams: Array<{chatId: string, apiParams: Partial<ChatSubmitParams>}> = [];
  
  // Add parameters for each chat based on mode
  const chatIds = ['chat1', 'chat2', 'chat3', 'chat4'];
  const enabledChats = mode === 'single' 
    ? [chatIds[0]] 
    : mode === 'dual' 
      ? [chatIds[0], chatIds[1]] 
      : chatIds;
  
  for (const chatId of enabledChats) {
    // Find or create conversation_id for this chat window
    const conversation_id = conversationIds[chatId] || crypto.randomUUID();
    
    chatParams.push({
      chatId,
      apiParams: {
        modelId: selectedModels[chatId],
        personaId: selectedPersonas[chatId],
        conversationId: conversation_id,
        multiConversationId: currentMultiConversationId,
        files: uploadedFiles.map(f => ({ name: f.name, url: f.uploadURL })),
        knowledgeBaseIds: selectedKnowledgeBases?.map(kb => kb.id),
        assetIds: selectedAssets?.map(asset => asset.id),
        webSearch
      }
    });
  }
  
  return { 
    newMessage, 
    currentMultiConversationId, 
    chatApiParams: chatParams 
  };
};

/**
 * Handles the complete chat submission process, from preparation to API calls
 * 
 * @param params All parameters needed for chat submission
 * @returns Results of the API calls
 */
export const handleChatSubmission = async ({
  input,
  uploadedFiles,
  mode,
  conversationIds,
  multiConversationId,
  selectedModels,
  selectedPersonas,
  selectedKnowledgeBases,
  selectedAssets,
  isWebSearchEnabled,
  allChatModels,
  session,
  getApiHeaders,
  retryAttempts,
  setRetryAttempts,
  setError,
  isStreamingRef,
  chatContainerRef,
  chatContainerRefs,
  personas,
  messages,
  messages2,
  messages3,
  messages4,
  setMessages,
  setMessages2,
  setMessages3,
  setMessages4,
  setConversationIds,
  setMultiConversationId
}: {
  input: string;
  uploadedFiles: UploadedFile[];
  mode: ChatMode;
  conversationIds: { [key: string]: string };
  multiConversationId: string | null;
  selectedModels: { [key: string]: string };
  selectedPersonas: { [key: string]: string };
  selectedKnowledgeBases: KnowledgeBase[];
  selectedAssets: Asset[];
  isWebSearchEnabled: boolean;
  allChatModels: ChatModel[] | undefined;
  session: any;
  getApiHeaders: () => any;
  retryAttempts: { [key: string]: number };
  setRetryAttempts: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
  setError: React.Dispatch<React.SetStateAction<Error | null>>;
  isStreamingRef: MutableRefObject<boolean>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  chatContainerRefs: MutableRefObject<{[key: string]: HTMLDivElement | null}>;
  personas: any[] | undefined;
  messages: Message[];
  messages2: Message[];
  messages3: Message[];
  messages4: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setMessages2: React.Dispatch<React.SetStateAction<Message[]>>;
  setMessages3: React.Dispatch<React.SetStateAction<Message[]>>;
  setMessages4: React.Dispatch<React.SetStateAction<Message[]>>;
  setConversationIds: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  setMultiConversationId: React.Dispatch<React.SetStateAction<string | null>>;
}): Promise<PromiseSettledResult<any>[]> => {
  // Prepare submission parameters
  const { 
    newMessage, 
    currentMultiConversationId, 
    chatApiParams 
  } = prepareChatSubmission(
    mode,
    conversationIds,
    multiConversationId,
    input,
    uploadedFiles,
    selectedModels,
    selectedPersonas,
    selectedKnowledgeBases,
    selectedAssets,
    isWebSearchEnabled,
    allChatModels
  );

  // Update state with the new message
  setMessages(prev => [...prev, newMessage]);
  if (mode !== 'single') {
    setMessages2(prev => [...prev, newMessage]);
    if (mode === 'quad') {
      setMessages3(prev => [...prev, newMessage]);
      setMessages4(prev => [...prev, newMessage]);
    }
  }
  
  // Update conversationIds with any new IDs generated
  const newConversationIds = { ...conversationIds };
  chatApiParams.forEach(({ chatId, apiParams }) => {
    if (apiParams.conversationId && !conversationIds[chatId]) {
      newConversationIds[chatId] = apiParams.conversationId;
    }
  });
  setConversationIds(newConversationIds);
  
  // Update multi-conversation ID if one was generated
  if (currentMultiConversationId && currentMultiConversationId !== multiConversationId) {
    setMultiConversationId(currentMultiConversationId);
  }

  // Prepare API calls for each relevant chat
  const apiCalls = [
    makeApiCall({
      session,
      getApiHeaders,
      uploadedFiles,
      selectedModels,
      selectedPersonas,
      conversationIds: newConversationIds,
      setConversationIds,
      currentMultiConversationId,
      retryAttempts,
      setRetryAttempts,
      setError,
      isStreamingRef,
      chatContainerRef,
      chatContainerRefs,
      selectedKnowledgeBases,
      selectedAssets,
      allChatModels,
      personas,
      isWebSearchEnabled,
      newMessage,
      prevMessagesLocal: messages,
      setMessagesFunction: setMessages,
      chatId: 'chat1'
    }),
    mode !== 'single' && makeApiCall({
      session,
      getApiHeaders,
      uploadedFiles,
      selectedModels,
      selectedPersonas,
      conversationIds: newConversationIds,
      setConversationIds,
      currentMultiConversationId,
      retryAttempts,
      setRetryAttempts,
      setError,
      isStreamingRef,
      chatContainerRef,
      chatContainerRefs,
      selectedKnowledgeBases,
      selectedAssets,
      allChatModels,
      personas,
      isWebSearchEnabled,
      newMessage,
      prevMessagesLocal: messages2,
      setMessagesFunction: setMessages2,
      chatId: 'chat2'
    }),
    mode === 'quad' && makeApiCall({
      session,
      getApiHeaders,
      uploadedFiles,
      selectedModels,
      selectedPersonas,
      conversationIds: newConversationIds,
      setConversationIds,
      currentMultiConversationId,
      retryAttempts,
      setRetryAttempts,
      setError,
      isStreamingRef,
      chatContainerRef,
      chatContainerRefs,
      selectedKnowledgeBases,
      selectedAssets,
      allChatModels,
      personas,
      isWebSearchEnabled,
      newMessage,
      prevMessagesLocal: messages3,
      setMessagesFunction: setMessages3,
      chatId: 'chat3'
    }),
    mode === 'quad' && makeApiCall({
      session,
      getApiHeaders,
      uploadedFiles,
      selectedModels,
      selectedPersonas,
      conversationIds: newConversationIds,
      setConversationIds,
      currentMultiConversationId,
      retryAttempts,
      setRetryAttempts,
      setError,
      isStreamingRef,
      chatContainerRef,
      chatContainerRefs,
      selectedKnowledgeBases,
      selectedAssets,
      allChatModels,
      personas,
      isWebSearchEnabled,
      newMessage,
      prevMessagesLocal: messages4,
      setMessagesFunction: setMessages4,
      chatId: 'chat4'
    }),
  ].filter(Boolean);

  // Use Promise.allSettled instead of Promise.all to handle individual failures
  const results = await Promise.allSettled(apiCalls);
  
  // Process API call results
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const chatId = ['chat1', 'chat2', 'chat3', 'chat4'][index];
      console.error(`Chat ${chatId} failed:`, result.reason);
      
      // Set error message for failed chats
      const errMsg = result.reason instanceof Error ? result.reason.message : 'Unknown error';
      setError(prevError =>
        prevError
          ? new Error(`${prevError.message}\nChat ${chatId}: ${errMsg}`)
          : new Error(`Chat ${chatId}: ${errMsg}`)
      );
    }
  });
  
  return results;
};
