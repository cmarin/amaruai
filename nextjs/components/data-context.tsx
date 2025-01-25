'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ChatModel as BaseChatModel, fetchChatModels } from '../utils/chat-model-service';
import { Persona, fetchPersonas } from '../utils/persona-service';
import { PromptTemplate, fetchPromptTemplates } from '@/utils/prompt-template-service';
import { Category, fetchCategories } from '../utils/category-service';
import { useSession } from '@/app/utils/session/session';

// Extend the base ChatModel type to include additional fields from the API
export interface ChatModel extends Omit<BaseChatModel, 'id'> {
  id: number;
  model_id: string;
  default: boolean;
  created_at: string;
  updated_at: string;
}

type DataContextType = {
  chatModels: ChatModel[];
  personas: Persona[];
  promptTemplates: PromptTemplate[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  refetchData: () => Promise<void>;
  setData: (data: {
    chatModels?: ChatModel[];
    personas?: Persona[];
    promptTemplates?: PromptTemplate[];
    categories?: Category[];
  }) => void;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);
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
      const [models, personasData, templates, categoriesData] = await Promise.all([
        fetchChatModels(headers),
        fetchPersonas(headers),
        fetchPromptTemplates(headers),
        fetchCategories(headers),
      ]);

      // Transform the chat models to include the additional fields
      const transformedModels = models.map(model => {
        const now = new Date().toISOString();
        return {
          ...model,
          id: typeof model.id === 'string' ? parseInt(model.id, 10) : model.id,
          model_id: model.model || '',
          // Set default based on model properties - assuming the first GPT-4 model is default
          default: model.model?.toLowerCase().includes('gpt-4') || false,
          created_at: now,
          updated_at: now
        };
      }) as ChatModel[];

      // Ensure exactly one model is default - prefer GPT-4, fallback to first model
      const hasDefault = transformedModels.some(m => m.default);
      if (!hasDefault && transformedModels.length > 0) {
        transformedModels[0].default = true;
      }

      setChatModels(transformedModels);
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
    personas?: Persona[];
    promptTemplates?: PromptTemplate[];
    categories?: Category[];
  }) => {
    if (data.chatModels) setChatModels(data.chatModels);
    if (data.personas) setPersonas(data.personas);
    if (data.promptTemplates) setPromptTemplates(data.promptTemplates);
    if (data.categories) setCategories(data.categories);
  }, []);

  const refetchData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return (
    <DataContext.Provider value={{
      chatModels,
      personas,
      promptTemplates,
      categories,
      isLoading,
      error,
      refetchData,
      setData,
    }}>
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
