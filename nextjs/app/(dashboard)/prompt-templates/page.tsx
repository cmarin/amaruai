'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  PromptTemplate, 
  fetchPromptTemplates, 
  createPromptTemplate, 
  deletePromptTemplate,
  favoritePromptTemplate,
  unfavoritePromptTemplate,
  fetchFavoritePromptTemplates,
  PromptTemplateFilters
} from '@/utils/prompt-template-service';
import { AppSidebar } from '@/components/app-sidebar';
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import TagSelector from '@/components/tag-selector'
import { Tag } from '@/utils/tag-service'
import { fetchCategories, Category } from '@/utils/category-service'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useSidebar } from '@/components/sidebar-context'
import { useSession } from '@/app/utils/session/session';
import PromptTemplateLibrary from '@/components/prompt-template-library';
import { ComboboxPersonas } from '@/components/combobox-personas';
import { ComboboxChatModels } from '@/components/combobox-chat-models';
import { useData } from '@/components/data-context';
import { Label } from "@/components/ui/label";

export default function PromptTemplatesPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewSimplePromptDialogOpen, setIsNewSimplePromptDialogOpen] = useState(false);
  const [newSimplePrompt, setNewSimplePrompt] = useState({
    title: '',
    prompt: '',
    category: '',
    tags: [] as Tag[],
    defaultPersonaId: null as string | null,
    defaultChatModelId: null as string | null,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { sidebarOpen } = useSidebar();
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { getApiHeaders, loading: sessionLoading, initialized, session } = useSession();
  const [isDeletePromptDialogOpen, setIsDeletePromptDialogOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<PromptTemplate | null>(null);
  const { personas, chatModels } = useData();
  const [filters, setFilters] = useState<PromptTemplateFilters>({
    sort_by: 'created_at',
    sort_order: 'desc',
  });

  const loadPrompts = useCallback(async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      const fetchedPrompts = await fetchPromptTemplates(headers, filters);
      setPrompts(fetchedPrompts);
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  }, [getApiHeaders, filters]);

  const handleUpdateFilters = (newFilters: Partial<PromptTemplateFilters>) => {
    // Prevent unnecessary filter updates if values are the same
    let hasChanged = false;
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (filters[key as keyof PromptTemplateFilters] !== value) {
        hasChanged = true;
      }
    });

    // Only update filters if something has actually changed
    if (hasChanged) {
      // If setting favorited_by, use actual user ID from session
      if ('favorited_by' in newFilters && newFilters.favorited_by === 'current_user') {
        newFilters.favorited_by = session?.user?.id || undefined;
      }
      
      setFilters(prev => ({
        ...prev,
        ...newFilters,
      }));
    }
  };

  useEffect(() => {
    if (!sessionLoading && initialized) {
      const loadData = async () => {
        const headers = getApiHeaders();
        if (!headers) {
          console.warn('No valid headers available - waiting for session');
          return;
        }

        try {
          setIsLoading(true);
          const [fetchedPrompts, fetchedCategories, fetchedFavorites] = await Promise.all([
            fetchPromptTemplates(headers, filters),
            fetchCategories(headers),
            fetchFavoritePromptTemplates(headers)
          ]);
          
          // Mark favorite prompts
          const favoriteIds = new Set(fetchedFavorites.map(p => p.id));
          const promptsWithFavorites = fetchedPrompts.map(prompt => ({
            ...prompt,
            is_favorite: favoriteIds.has(prompt.id)
          }));
          
          setPrompts(promptsWithFavorites);
          setCategories(fetchedCategories);
          setError(null);
        } catch (err) {
          console.error('Error loading data:', err);
          setError('Failed to load data');
        } finally {
          setIsLoading(false);
        }
      };

      loadData();
    }
  }, [sessionLoading, initialized, getApiHeaders, filters]);

  const filteredPrompts = prompts.filter(prompt =>
    (prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (prompt.description || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!selectedCategory || prompt.categories.some(category => category.name === selectedCategory)) &&
    (!showFavoritesOnly || prompt.is_favorite)
  );

  const allCategories = Array.from(new Set(prompts.flatMap((prompt) => prompt.categories.map(category => category.name))));

  const handleNewSimplePrompt = () => {
    setIsNewSimplePromptDialogOpen(true);
  };

  const handleNewComplexPrompt = () => {
    router.push('/prompt-templates/new?type=complex');
  };

  const handleEditPrompt = (prompt: PromptTemplate) => {
    router.push(`/prompt-templates/${prompt.id}`);
  };

  const handleDeletePrompt = (prompt: PromptTemplate) => {
    setPromptToDelete(prompt);
    setIsDeletePromptDialogOpen(true);
  };

  const handleSaveNewSimplePrompt = async () => {
    const headers = getApiHeaders();
    if (!headers) return;

    try {
      await createPromptTemplate({
        title: newSimplePrompt.title,
        prompt: newSimplePrompt.prompt,
        is_complex: false,
        category_ids: [newSimplePrompt.category],
        tags: newSimplePrompt.tags.map(t => t.name),
        default_persona_id: newSimplePrompt.defaultPersonaId,
        default_chat_model_id: newSimplePrompt.defaultChatModelId,
      }, headers);

      // Reset form and close dialog
      setNewSimplePrompt({
        title: '',
        prompt: '',
        category: '',
        tags: [],
        defaultPersonaId: null,
        defaultChatModelId: null,
      });
      setIsNewSimplePromptDialogOpen(false);

      // Refresh the prompts list
      const updatedPrompts = await fetchPromptTemplates(headers, filters);
      setPrompts(updatedPrompts);
    } catch (error) {
      console.error('Error creating prompt template:', error);
    }
  };

  const confirmDelete = async () => {
    if (promptToDelete) {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      try {
        // Optimistically update UI first
        setPrompts(currentPrompts => currentPrompts.filter(p => p.id !== promptToDelete.id));
        setIsDeletePromptDialogOpen(false);
        setPromptToDelete(null);
        
        // Then perform the delete operation
        await deletePromptTemplate(promptToDelete.id, headers);
      } catch (error) {
        console.error('Error deleting prompt template:', error);
        // On error, revert the optimistic update by fetching fresh data
        const updatedPrompts = await fetchPromptTemplates(headers, filters);
        setPrompts(updatedPrompts);
      }
    }
  };

  const handleFavoriteToggle = async (prompt: PromptTemplate) => {
    const headers = getApiHeaders();
    if (!headers) {
      console.warn('No valid headers available');
      return;
    }

    try {
      if (prompt.is_favorite) {
        await unfavoritePromptTemplate(prompt.id, headers);
      } else {
        await favoritePromptTemplate(prompt.id, headers);
      }

      // Update local state
      setPrompts(prompts.map(p => 
        p.id === prompt.id 
          ? { ...p, is_favorite: !p.is_favorite }
          : p
      ));
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setError('Failed to update favorite status');
    }
  };

  const handlePersonaSelect = (persona: any) => {
    setNewSimplePrompt(prev => ({
      ...prev,
      defaultPersonaId: persona?.id?.toString() || null
    }));
  };

  const handleChatModelSelect = (model: any) => {
    setNewSimplePrompt(prev => ({
      ...prev,
      defaultChatModelId: model?.id || null
    }));
  };

  if (sessionLoading || isLoading) return <div>Loading prompts...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="h-full w-full">
      <div className="flex h-screen">
        <AppSidebar />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <PromptTemplateLibrary
            prompts={filteredPrompts}
            onEdit={handleEditPrompt}
            onDelete={handleDeletePrompt}
            onNewSimple={handleNewSimplePrompt}
            onNewComplex={handleNewComplexPrompt}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            categories={allCategories}
            onFavoriteToggle={handleFavoriteToggle}
            onUpdateFilters={handleUpdateFilters}
          />

          {/* New Simple Prompt Dialog */}
          <Dialog open={isNewSimplePromptDialogOpen} onOpenChange={setIsNewSimplePromptDialogOpen}>
            <DialogContent className="bg-white" style={{ zIndex: 50 }}>
              <DialogHeader>
                <DialogTitle className="text-gray-900">New Prompt Template</DialogTitle>
                <DialogDescription className="text-gray-600">Create a new prompt template</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input
                  placeholder="Title"
                  value={newSimplePrompt.title}
                  onChange={(e) => setNewSimplePrompt({ ...newSimplePrompt, title: e.target.value })}
                  className="border-gray-300"
                />
                <Textarea
                  placeholder="Prompt content"
                  value={newSimplePrompt.prompt}
                  onChange={(e) => setNewSimplePrompt({ ...newSimplePrompt, prompt: e.target.value })}
                  className="border-gray-300"
                />
                <Select
                  value={newSimplePrompt.category}
                  onValueChange={(value) => setNewSimplePrompt({ ...newSimplePrompt, category: value })}
                >
                  <SelectTrigger className="border-gray-300">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block">Default Persona</Label>
                    <div className="relative">
                      <ComboboxPersonas
                        personas={personas || []}
                        value={newSimplePrompt.defaultPersonaId || undefined}
                        onSelect={handlePersonaSelect}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Default Chat Model</Label>
                    <div className="relative">
                      <ComboboxChatModels
                        models={chatModels || []}
                        value={newSimplePrompt.defaultChatModelId}
                        onSelect={handleChatModelSelect}
                      />
                    </div>
                  </div>
                </div>
                <TagSelector
                  tags={newSimplePrompt.tags}
                  setTags={(tags) => setNewSimplePrompt({ ...newSimplePrompt, tags })}
                  placeholder="Add tags"
                />
              </div>
              <DialogFooter>
                <Button onClick={handleSaveNewSimplePrompt}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={isDeletePromptDialogOpen} onOpenChange={setIsDeletePromptDialogOpen}>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-gray-900">Are you sure you want to delete this prompt template?</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-600">
                  This action cannot be undone. The prompt template will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-100 text-gray-900 hover:bg-gray-200">Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
