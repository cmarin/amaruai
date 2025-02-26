import { Asset } from './knowledge-base';
import { ReactNode, RefObject } from 'react';
import type { UploadedFile } from '@/utils/upload-service';
import type { KnowledgeBase } from '@/utils/knowledge-base-service';
import type { ChatModel } from '@/components/data-context';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatMode = 'single' | 'dual' | 'quad';

// Service interfaces moved from chat-service.ts
export interface ApiResponse {
  success: boolean;
  errorMessage?: string;
}

export interface ChatSubmitParams {
  messages: Message[];
  userId?: string;
  modelId?: string;
  personaId?: string;
  files?: Array<{ name: string; url: string }>;
  conversationId: string;
  multiConversationId?: string | null;
  knowledgeBaseIds?: string[];
  assetIds?: string[];
  webSearch?: boolean;
  headers?: Record<string, string>;
}

export interface SubmitChatMessagesParams {
  input: string;
  uploadedFiles: UploadedFile[];
  messages: Message[];
  session: any;
  getApiHeaders: () => any;
  modelId?: string;
  personaId?: string;
  conversationId?: string;
  multiConversationId?: string | null;
  selectedKnowledgeBases?: KnowledgeBase[];
  selectedAssets?: Asset[];
  webSearch?: boolean;
}

export interface ChatWindowProps {
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement>;
  title: string;
  Icon: React.ComponentType<any>;
  onCopy: () => void;
  onAddToScratchPad: () => void;
  onClearConversation: () => void;
  isCopied: boolean;
  chatWindowId: string;
}

export interface ChatState {
  messages: Message[];
  messages2: Message[];
  messages3: Message[];
  messages4: Message[];
  input: string;
  isLoading: boolean;
  error: Error | null;
  mode: ChatMode;
  copiedStates: { [key: string]: boolean };
  selectedComplexPrompt: any | null;
  selectedModels: { [key: string]: string };
  selectedPersonas: { [key: string]: string };
  conversationIds: { [key: string]: string };
  multiConversationId: string | null;
  uploadedFiles: UploadedFile[];
  showUploadModal: boolean;
  knowledgeBases: KnowledgeBase[];
  assets: Asset[];
  selectedKnowledgeBases: KnowledgeBase[];
  selectedAssets: Asset[];
  isLoadingKnowledgeBases: boolean;
  retryAttempts: { [key: string]: number };
  isWebSearchEnabled: boolean;
  showKnowledgeBaseModal: boolean;
}

export interface ApiCallParams {
  prevMessagesLocal: Message[];
  setMessagesFunction: React.Dispatch<React.SetStateAction<Message[]>>;
  chatId: string;
  isRetry?: boolean;
  newMessage: Message;
  session: any;
  getApiHeaders: () => any;
  uploadedFiles: UploadedFile[];
  selectedModels: { [key: string]: string };
  selectedPersonas: { [key: string]: string };
  conversationIds: { [key: string]: string };
  setConversationIds: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  currentMultiConversationId: string | null;
  retryAttempts: { [key: string]: number };
  setRetryAttempts: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
  setError: React.Dispatch<React.SetStateAction<Error | null>>;
  isStreamingRef: React.MutableRefObject<boolean>;
  chatContainerRef: RefObject<HTMLDivElement>;
  selectedKnowledgeBases: KnowledgeBase[];
  selectedAssets: Asset[];
  allChatModels: ChatModel[] | undefined;
  personas: any[] | undefined;
  isWebSearchEnabled: boolean;
  mode?: ChatMode;
  activeStreamsRef?: React.MutableRefObject<Set<string>>;
} 