'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ChatModel as BaseChatModel, fetchChatModels, fetchFavoriteChatModels } from '../utils/chat-model-service';
import { Persona, fetchPersonas } from '../utils/persona-service';
import { PromptTemplate, fetchPromptTemplates } from '@/utils/prompt-template-service';
import { Category, fetchCategories } from '../utils/category-service';
import { KnowledgeBase, fetchKnowledgeBases } from '../utils/knowledge-base-service';
import { useSession } from '@/app/utils/session/session';

// Extend the base ChatModel type to include additional fields from the API
export interface ChatModel extends Omit<BaseChatModel, 'id'> {
  id: string;
  model_id: string;
  default: boolean;
  created_at: string;
  updated_at: string;
  is_favorite: boolean;
}

type DataContextType = {
  chatModels: ChatModel[];
  favoriteChatModels: ChatModel[];
  personas: Persona[];
  promptTemplates: PromptTemplate[];
  categories: Category[];
  knowledgeBases: KnowledgeBase[];
  isLoading: boolean;
  error: string | null;
  refetchData: () => Promise<void>;
  setData: (data: {
    chatModels?: ChatModel[];
    favoriteChatModels?: ChatModel[];
    personas?: Persona[];
    promptTemplates?: PromptTemplate[];
    categories?: Category[];
    knowledgeBases?: KnowledgeBase[];
  }) => void;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);
  const [favoriteChatModels, setFavoriteChatModels] = useState<ChatModel[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getApiHeaders, initialized } = useSession();

  // Transform function defined outside the loop to avoid hoisting issues
  const transformChatModels = (models: BaseChatModel[]): ChatModel[] => {
    return models.map(model => {
      const now = new Date().toISOString();
      return {
        ...model,
        model_id: model.model || '',
        default: model.model?.toLowerCase().includes('gpt-4') || false,
        created_at: now,
        updated_at: now,
        is_favorite: false
      };
    });
  };

  const fetchData = useCallback(async () => {
    if (!initialized) return;

    setIsLoading(true);
    setError(null);

    try {
      const headers = await getApiHeaders();
      if (!headers) {
        throw new Error('No API headers available');
      }

      const [
        chatModelsData,
        favoriteChatModelsData,
        personasData,
        promptTemplatesData,
        categoriesData,
        knowledgeBasesData
      ] = await Promise.all([
        fetchChatModels(headers),
        fetchFavoriteChatModels(headers),
        fetchPersonas(headers),
        fetchPromptTemplates(headers),
        fetchCategories(headers),
        fetchKnowledgeBases(headers)
      ]);

      setChatModels(transformChatModels(chatModelsData));
      setFavoriteChatModels(transformChatModels(favoriteChatModelsData));
      setPersonas(personasData);
      setPromptTemplates(promptTemplatesData);
      setCategories(categoriesData);
      setKnowledgeBases(knowledgeBasesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [initialized, getApiHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const value = {
    chatModels,
    favoriteChatModels,
    personas,
    promptTemplates,
    categories,
    knowledgeBases,
    isLoading,
    error,
    refetchData: fetchData,
    setData: (data: {
      chatModels?: ChatModel[];
      favoriteChatModels?: ChatModel[];
      personas?: Persona[];
      promptTemplates?: PromptTemplate[];
      categories?: Category[];
      knowledgeBases?: KnowledgeBase[];
    }) => {
      if (data.chatModels) setChatModels(data.chatModels);
      if (data.favoriteChatModels) setFavoriteChatModels(data.favoriteChatModels);
      if (data.personas) setPersonas(data.personas);
      if (data.promptTemplates) setPromptTemplates(data.promptTemplates);
      if (data.categories) setCategories(data.categories);
      if (data.knowledgeBases) setKnowledgeBases(data.knowledgeBases);
    }
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
