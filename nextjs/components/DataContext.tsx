'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { fetchChatModels, ChatModel } from './chatModelService';
import { fetchPersonas, Persona } from './personaService';
import { fetchPromptTemplates, PromptTemplate } from './promptTemplateService';
import { fetchCategories, Category } from './categoryService';

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

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  const fetchData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && lastFetchTime && now - lastFetchTime < 60000) {
      // If not forced and last fetch was less than a minute ago, don't fetch again
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const cachedData = localStorage.getItem('cachedData');
      const cachedTimestamp = localStorage.getItem('cachedTimestamp');

      if (!force && cachedData && cachedTimestamp && now - parseInt(cachedTimestamp) < 60000) {
        // Use cached data if it's less than 1 minute old
        const parsedData = JSON.parse(cachedData);
        setChatModels(parsedData.chatModels);
        setPersonas(parsedData.personas);
        setPromptTemplates(parsedData.promptTemplates);
        setCategories(parsedData.categories);
      } else {
        const [modelsData, personasData, promptsData, categoriesData] = await Promise.all([
          fetchChatModels(),
          fetchPersonas(),
          fetchPromptTemplates(),
          fetchCategories()
        ]);

        setChatModels(modelsData);
        setPersonas(personasData);
        setPromptTemplates(promptsData);
        setCategories(categoriesData);

        // Cache the fetched data
        localStorage.setItem('cachedData', JSON.stringify({
          chatModels: modelsData,
          personas: personasData,
          promptTemplates: promptsData,
          categories: categoriesData
        }));
        localStorage.setItem('cachedTimestamp', now.toString());
      }

      setLastFetchTime(now);
    } catch (err) {
      setError('Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [lastFetchTime]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const value = useMemo(() => ({
    chatModels,
    personas,
    promptTemplates,
    categories,
    isLoading,
    error,
    refetchData: () => fetchData(true)
  }), [chatModels, personas, promptTemplates, categories, isLoading, error, fetchData]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};