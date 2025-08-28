'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ChatModel as BaseChatModel, fetchChatModels, fetchFavoriteChatModels } from '../utils/chat-model-service';
import { Persona, fetchPersonas } from '../utils/persona-service';
import { PromptTemplate, fetchPromptTemplates, fetchInitialPromptTemplates } from '@/utils/prompt-template-service';
import { Category, fetchCategories } from '../utils/category-service';
import { useSession } from '@/app/utils/session/session';
import { invalidateCache, clearCache } from '../utils/api-request-manager';

// Extend the base ChatModel type to include additional fields from the API
export interface ChatModel extends Omit<BaseChatModel, 'id'> {
  id: string;
  model_id: string;
  default: boolean;
  created_at: string;
  updated_at: string;
  is_favorite: boolean;
  position?: number | null;
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
  // Cache management methods
  invalidateCache: (pattern: string | RegExp) => void;
  clearAllCache: () => void;
  refreshData: (forceRefresh?: boolean) => Promise<void>;
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
  const [isFetching, setIsFetching] = useState(false);
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
        is_favorite: model.is_favorite || false,
        // Preserve the position value if it exists
        position: model.position !== undefined ? model.position : null
      };
    });
  };

  // Use a ref for more reliable fetch lock tracking
  const fetchLockRef = useRef(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Guard against uninitialized session
    if (!initialized) {
      console.log('Session not initialized, skipping fetch');
      return;
    }

    // Check if we're already fetching using the ref
    if (fetchLockRef.current) {
      console.log('Fetch already in progress, skipping duplicate fetch');
      return;
    }

    const headers = getApiHeaders();
    if (!headers) {
      console.error('No valid headers available');
      return;
    }

    // Set the lock
    fetchLockRef.current = true;
    setIsLoading(true);
    setIsFetching(true);
    setError(null);

    // Log which user is being fetched for
    const userId = session?.user?.id;
    console.log('Fetching data for user:', userId, forceRefresh ? '(force refresh)' : '(cached)');

    // Performance timing (development only)
    const startTime = process.env.NODE_ENV === 'development' ? performance.now() : 0;

    try {
      // Parallel fetches for optimal performance
      console.log('Starting parallel data fetches...');
      
      const results = await Promise.allSettled([
        fetchChatModels(headers),
        fetchFavoriteChatModels(headers),
        fetchPersonas(headers),
        fetchCategories(headers),
        userId ? fetchInitialPromptTemplates(headers, userId) : Promise.resolve([])
      ]);

      // Process results with individual error handling
      const [chatModelsResult, favChatModelsResult, personasResult, categoriesResult, promptTemplatesResult] = results;

      // 1. Handle chat models
      if (chatModelsResult.status === 'fulfilled') {
        setChatModels(transformChatModels(chatModelsResult.value));
      } else {
        console.error('Error fetching chat models:', chatModelsResult.reason);
      }

      // 2. Handle favorite chat models
      if (favChatModelsResult.status === 'fulfilled') {
        setFavoriteChatModels(
          transformChatModels(favChatModelsResult.value).map(model => ({
            ...model,
            is_favorite: true
          }))
        );
      } else {
        console.error('Error fetching favorite chat models:', favChatModelsResult.reason);
      }

      // 3. Handle personas
      if (personasResult.status === 'fulfilled') {
        setPersonas(personasResult.value);
      } else {
        console.error('Error fetching personas:', personasResult.reason);
      }

      // 4. Handle categories
      if (categoriesResult.status === 'fulfilled') {
        setCategories(categoriesResult.value);
      } else {
        console.error('Error fetching categories:', categoriesResult.reason);
      }

      // 5. Handle prompt templates
      if (promptTemplatesResult.status === 'fulfilled') {
        const templates = promptTemplatesResult.value;
        console.log('Fetched prompt templates:', templates.length, 'favorites:', templates.filter(t => t.is_favorite).length);
        setPromptTemplates(templates);
      } else {
        console.error('Error fetching prompt templates:', promptTemplatesResult.reason);
      }

      // Log performance improvement (development only)
      if (process.env.NODE_ENV === 'development') {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        const successfulFetches = results.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ Parallel data fetch completed: ${duration}ms (${successfulFetches}/${results.length} successful)`);
      }

      console.log('All data fetches completed');
    } catch (err) {
      console.error('Error in fetchData:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
      setIsFetching(false);
      
      // Clear the fetch lock after a delay to prevent rapid successive calls
      setTimeout(() => {
        fetchLockRef.current = false;
      }, 2000);
    }
  }, [getApiHeaders, initialized, session]);

  // Use a stable dependency array to prevent unnecessary re-renders
  useEffect(() => {
    if (initialized && session?.user?.id) {
      console.log('Session initialized and user ID available, fetching data');
      fetchData();
    }
  }, [initialized, session?.user?.id]);  // Only depend on these essential variables

  const setData = useCallback((data: {
    chatModels?: ChatModel[];
    favoriteChatModels?: ChatModel[];
    personas?: Persona[];
    promptTemplates?: PromptTemplate[];
    categories?: Category[];
  }) => {
    // Only update states that actually change
    if (data.chatModels) setChatModels(prev => 
      JSON.stringify(prev) !== JSON.stringify(data.chatModels) ? data.chatModels! : prev);
    
    if (data.favoriteChatModels) setFavoriteChatModels(prev => 
      JSON.stringify(prev) !== JSON.stringify(data.favoriteChatModels) ? data.favoriteChatModels! : prev);
    
    if (data.personas) setPersonas(prev => 
      JSON.stringify(prev) !== JSON.stringify(data.personas) ? data.personas! : prev);
    
    if (data.promptTemplates) {
      setPromptTemplates(prev => {
        // Check if this update has different content than the current state
        if (JSON.stringify(prev) !== JSON.stringify(data.promptTemplates)) {
          // Log information about the favorites to help debug
          const prevFavorites = prev.filter(p => p.is_favorite).length;
          const newFavorites = data.promptTemplates!.filter(p => p.is_favorite).length;
          
          console.log(`Updating promptTemplates: ${prev.length} -> ${data.promptTemplates!.length} (Favorites: ${prevFavorites} -> ${newFavorites})`);
          
          // Ensure favorites are properly marked
          const templates = data.promptTemplates!.map(template => ({
            ...template,
            // Ensure is_favorite flag is explicitly set 
            is_favorite: !!template.is_favorite
          }));
          
          return templates;
        }
        return prev;
      });
    }
    
    if (data.categories) setCategories(prev => 
      JSON.stringify(prev) !== JSON.stringify(data.categories) ? data.categories! : prev);
  }, []);

  const refetchData = useCallback(async () => {
    // Only refetch if not currently fetching
    if (!fetchLockRef.current) {
      await fetchData();
    } else {
      console.log('Skipping refetch - fetch already in progress');
    }
  }, [fetchData]);

  // Cache management methods
  const handleInvalidateCache = useCallback((pattern: string | RegExp) => {
    invalidateCache(pattern);
    console.log('Cache invalidated for pattern:', pattern);
  }, []);

  const handleClearAllCache = useCallback(() => {
    clearCache();
    console.log('All cache cleared');
  }, []);

  const refreshData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      // Clear relevant cache entries before refetching
      clearCache();
    }
    await fetchData(forceRefresh);
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
        invalidateCache: handleInvalidateCache,
        clearAllCache: handleClearAllCache,
        refreshData,
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