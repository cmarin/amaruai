'use client';

import React, { useState, useEffect } from 'react';
import { fetchPromptTemplates, PromptTemplate } from '@/components/promptTemplateService';
import PromptLibrary from '@/components/prompt-library';

export default function PromptTemplatesPage() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPromptTemplates();
  }, []);

  const loadPromptTemplates = async () => {
    try {
      setIsLoading(true);
      const fetchedPrompts = await fetchPromptTemplates();
      setPrompts(fetchedPrompts);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading prompt templates:', error);
      setError('Failed to load prompt templates');
      setIsLoading(false);
    }
  };

  if (isLoading) return <div>Loading prompt templates...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <PromptLibrary
      onBack={() => {/* Implement your back logic here */}}
      onSelectPrompt={(prompt) => {/* Implement your select prompt logic here */}}
      prompts={prompts}
      onUpdatePrompts={loadPromptTemplates}
    />
  );
}
