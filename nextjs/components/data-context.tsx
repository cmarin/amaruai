'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ChatModel, fetchChatModels } from './chat-model-service';
import { Persona, fetchPersonas } from './persona-service';
import { PromptTemplate, fetchPromptTemplates } from './prompt-template-service';
import { Category, fetchCategories } from './category-service';
import { useSession } from '@/app/utils/session/session';

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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL is not configured');
      }

      if (!apiUrl.startsWith('https://')) {
        console.warn('Warning: API URL should use HTTPS in production');
      }

      const [
        fetchedChatModels,
        fetchedPersonas,
        fetchedPromptTemplates,
        fetchedCategories
      ] = await Promise.all([
        fetchChatModels(headers).catch((err: Error) => {
          console.error('Error fetching chat models:', err);
          return [];
        }),
        fetchPersonas(headers).catch((err: Error) => {
          console.error('Error fetching personas:', err);
          return [];
        }),
        fetchPromptTemplates(headers).catch((err: Error) => {
          console.error('Error fetching prompt templates:', err);
          return [];
        }),
        fetchCategories(headers).catch((err: Error) => {
          console.error('Error fetching categories:', err);
          return [];
        })
      ]);

      setChatModels(fetchedChatModels);
      setPersonas(fetchedPersonas);
      setPromptTemplates(fetchedPromptTemplates);
      setCategories(fetchedCategories);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
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
