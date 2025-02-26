'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ChatModel as BaseChatModel, fetchChatModels, fetchFavoriteChatModels } from '../utils/chat-model-service';
import { Persona, fetchPersonas } from '../utils/persona-service';
import { PromptTemplate, fetchPromptTemplates, fetchInitialPromptTemplates } from '@/utils/prompt-template-service';
import { Category, fetchCategories } from '../utils/category-service';
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
  isLoading: boolean;
  error: string | null;
  refetchData: () => Promise<void>;
  setData: (data: {
    chatModels?: ChatModel[];
    favoriteChatModels?: ChatModel[];
    personas?: Persona[];
    promptTemplates?: PromptTemplate[];
    categories?: Category[];
  }) => void;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);
  const [favoriteChatModels, setFavoriteChatModels] = useState<ChatModel[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getApiHeaders, initialized, session } = useSession();

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

    const headers = getApiHeaders();
    if (!headers) {
      console.error('No valid headers available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch each resource independently to handle partial failures
      const fetchResults = await Promise.allSettled([
        fetchChatModels(headers),
        fetchFavoriteChatModels(headers),
        fetchPersonas(headers),
        fetchInitialPromptTemplates(headers, session?.user?.id),
        fetchCategories(headers),
      ]);

      console.log('Fetch results:', fetchResults);

      // Process each result individually with proper type handling
      fetchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          switch (index) {
            case 0: // chatModels
              setChatModels(transformChatModels(result.value as BaseChatModel[]));
              break;

            case 1: // favoriteChatModels
              setFavoriteChatModels(
                transformChatModels(result.value as BaseChatModel[]).map(model => ({
                  ...model,
                  is_favorite: true
                }))
              );
              break;

            case 2: // personas
              console.log('Setting personas:', result.value);
              setPersonas(result.value as Persona[]);
              break;

            case 3: // promptTemplates
              setPromptTemplates(result.value as PromptTemplate[]);
              break;

            case 4: // categories
              setCategories(result.value as Category[]);
              break;
          }
        } else {
          console.error(`Failed to fetch data for index ${index}:`, result.reason);
        }
      });
    } catch (err) {
      console.error('Error in fetchData:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [getApiHeaders, initialized, session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setData = useCallback((data: {
    chatModels?: ChatModel[];
    favoriteChatModels?: ChatModel[];
    personas?: Persona[];
    promptTemplates?: PromptTemplate[];
    categories?: Category[];
  }) => {
    if (data.chatModels) setChatModels(data.chatModels);
    if (data.favoriteChatModels) setFavoriteChatModels(data.favoriteChatModels);
    if (data.personas) setPersonas(data.personas);
    if (data.promptTemplates) setPromptTemplates(data.promptTemplates);
    if (data.categories) setCategories(data.categories);
  }, []);

  const refetchData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return (
    <DataContext.Provider
      value={{
        chatModels,
        favoriteChatModels,
        personas,
        promptTemplates,
        categories,
        isLoading,
        error,
        refetchData,
        setData,
      }}
    >
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