'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchChatModels, ChatModel } from './chatModelService';
import { fetchPersonas, Persona } from './personaService';
import { fetchPromptTemplates, PromptTemplate } from './promptTemplateService';
import { fetchCategories, Category } from './categoryService';
import { useSession } from '@/app/utils/session/session';

interface DataContextType {
  chatModels: ChatModel[];
  personas: Persona[];
  promptTemplates: PromptTemplate[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  refetchData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getApiHeaders, loading: sessionLoading, initialized } = useSession();

  const fetchData = useCallback(async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.warn('No valid headers available - waiting for session');
        return;
      }

      console.log('Fetching data with headers:', headers);
      const [
        fetchedChatModels,
        fetchedPersonas,
        fetchedPromptTemplates,
        fetchedCategories,
      ] = await Promise.all([
        fetchChatModels(headers),
        fetchPersonas(headers),
        fetchPromptTemplates(headers),
        fetchCategories(headers),
      ]);

      setChatModels(fetchedChatModels);
      setPersonas(fetchedPersonas);
      setPromptTemplates(fetchedPromptTemplates);
      setCategories(fetchedCategories);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [getApiHeaders]);

  useEffect(() => {
    if (!sessionLoading && initialized) {
      fetchData();
    }
  }, [sessionLoading, initialized, fetchData]);

  const value = {
    chatModels,
    personas,
    promptTemplates,
    categories,
    isLoading: isLoading || sessionLoading || !initialized,
    error,
    refetchData: fetchData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
