'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ChatModel as BaseChatModel, fetchChatModels, fetchFavoriteChatModels } from '../utils/chat-model-service';
import { Persona, fetchPersonas } from '../utils/persona-service';
import { PromptTemplate, fetchPromptTemplates } from '@/utils/prompt-template-service';
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
  const { getApiHeaders, initialized } = useSession();

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
      const [allModels, favoriteModels, personasData, templates, categoriesData] = await Promise.all([
        fetchChatModels(headers),
        fetchFavoriteChatModels(headers),
        fetchPersonas(headers),
        fetchPromptTemplates(headers),
        fetchCategories(headers),
      ]);

      // Transform the chat models to include the additional fields
      const transformAllModels = (models: BaseChatModel[]) => models.map(model => {
        const now = new Date().toISOString();
        return {
          ...model,
          model_id: model.model || '',
          default: model.model?.toLowerCase().includes('gpt-4') || false,
          created_at: now,
          updated_at: now,
          is_favorite: false
        };
      }) as ChatModel[];

      // Create a set of favorite model IDs for quick lookup
      const favoriteIds = new Set(favoriteModels.map(m => m.id));

      // Transform all models and mark favorites
      const transformedAllModels = transformAllModels(allModels).map(model => ({
        ...model,
        is_favorite: favoriteIds.has(model.id)
      }));

      // Transform favorite models
      const transformedFavoriteModels = transformAllModels(favoriteModels).map(model => ({
        ...model,
        is_favorite: true
      }));

      // Ensure exactly one model is default - prefer GPT-4, fallback to first model
      const hasDefault = transformedAllModels.some(m => m.default);
      if (!hasDefault && transformedAllModels.length > 0) {
        transformedAllModels[0].default = true;
      }

      setChatModels(transformedAllModels);
      setFavoriteChatModels(transformedFavoriteModels);
      setPersonas(personasData);
      setPromptTemplates(templates);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [getApiHeaders, initialized]);

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
