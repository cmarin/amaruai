'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PromptTemplate, fetchPromptTemplates, createPromptTemplate, updatePromptTemplate, deletePromptTemplate } from '@/utils/prompt-template-service';
import { AppSidebar } from '@/components/app-sidebar';
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import TagSelector from '@/components/tag-selector'
import { Tag } from '@/utils/tag-service'
import { ComplexPromptEditor, PromptContent } from '@/components/complex-prompt-editor'
import { fetchCategories, Category } from '@/utils/category-service'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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

export default function PromptTemplatesPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewSimplePromptDialogOpen, setIsNewSimplePromptDialogOpen] = useState(false);
  const [isEditPromptDialogOpen, setIsEditPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [newSimplePrompt, setNewSimplePrompt] = useState({
    title: '',
    prompt: '',
    category: '',
    tags: [] as Tag[],
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isComplexEditorOpen, setIsComplexEditorOpen] = useState(false);
  const [selectedComplexPrompt, setSelectedComplexPrompt] = useState<PromptTemplate | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<PromptTemplate | null>(null)
  const { sidebarOpen } = useSidebar()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { getApiHeaders, loading: sessionLoading, initialized } = useSession();

  useEffect(() => {
    if (!sessionLoading && initialized) {
      const loadData = async () => {
        const headers = getApiHeaders();
        if (!headers) {
          console.warn('No valid headers available - waiting for session');
          return;
        }

        try {
          const [fetchedPrompts, fetchedCategories] = await Promise.all([
            fetchPromptTemplates(headers),
            fetchCategories(headers)
          ]);
          
          setPrompts(fetchedPrompts);
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
  }, [sessionLoading, initialized, getApiHeaders]);

  const toggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  };

  const filteredPrompts = prompts.filter(prompt =>
    (prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (prompt.description || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!selectedCategory || prompt.categories.some(category => category.name === selectedCategory))
  );

  const allCategories = Array.from(new Set(prompts.flatMap((prompt) => prompt.categories.map(category => category.name))));

  const handleNewSimplePrompt = () => {
    setIsNewSimplePromptDialogOpen(true);
  };

  const handleNewComplexPrompt = () => {
    setIsComplexEditorOpen(true);
    setSelectedComplexPrompt(null);
  };

  const handleEditPrompt = (prompt: PromptTemplate) => {
    if (prompt.is_complex) {
      setSelectedComplexPrompt(prompt);
      setIsComplexEditorOpen(true);
    } else {
      setEditingPrompt(prompt);
      setIsEditPromptDialogOpen(true);
    }
  };

  const handleDeletePrompt = (prompt: PromptTemplate) => {
    setTemplateToDelete(prompt);
    setShowDeleteConfirmation(true);
  };

  const handleSaveNewSimplePrompt = async () => {
    const headers = getApiHeaders();
    if (!headers) {
      console.error('No valid headers available');
      return;
    }

    try {
      await createPromptTemplate({
        title: newSimplePrompt.title,
        prompt: newSimplePrompt.prompt,
        is_complex: false,
        category_ids: newSimplePrompt.category ? [parseInt(newSimplePrompt.category)] : [],
        tag_ids: newSimplePrompt.tags.map(tag => tag.id || tag.name),
      }, headers);
      
      setIsNewSimplePromptDialogOpen(false);
      const updatedPrompts = await fetchPromptTemplates(headers);
      setPrompts(updatedPrompts);
    } catch (error) {
      console.error('Error saving new prompt:', error);
      setError('Failed to save prompt');
    }
  };

  const handleSaveEditedPrompt = async () => {
    if (!editingPrompt) return;
    const headers = getApiHeaders();
    if (!headers) {
      console.error('No valid headers available');
      return;
    }
    try {
      await updatePromptTemplate(editingPrompt.id, {
        title: editingPrompt.title,
        prompt: editingPrompt.prompt as string,
        is_complex: false,
        default_persona_id: editingPrompt.default_persona_id || null,
        category_ids: editingPrompt.category ? [parseInt(editingPrompt.category)] : [],
        tag_ids: editingPrompt.tags.map(t => t.id || t.name),
      }, headers);
      setIsEditPromptDialogOpen(false);
      const updatedPrompts = await fetchPromptTemplates(headers);
      setPrompts(updatedPrompts);
    } catch (error) {
      console.error('Error updating prompt:', error);
    }
  };

  const handleSaveComplexPrompt = async (
    title: string,
    category: string,
    tags: Tag[],
    data: PromptContent
  ) => {
    const headers = getApiHeaders();
    if (!headers) {
      console.error('No valid headers available');
      return;
    }
    try {
      if (selectedComplexPrompt) {
        await updatePromptTemplate(selectedComplexPrompt.id, {
          title,
          prompt: JSON.stringify(data),
          is_complex: true,
          default_persona_id: selectedComplexPrompt.default_persona_id || null,
          category_ids: [parseInt(category)],
          tag_ids: tags.map(t => t.id || t.name),
        }, headers);
      } else {
        await createPromptTemplate({
          title,
          prompt: JSON.stringify(data),
          is_complex: true,
          category_ids: [parseInt(category)],
          tag_ids: tags.map(t => t.id || t.name),
        }, headers);
      }
      setIsComplexEditorOpen(false);
      setSelectedComplexPrompt(null);
      const updatedPrompts = await fetchPromptTemplates(headers);
      setPrompts(updatedPrompts);
    } catch (error) {
      console.error('Error saving complex prompt:', error);
    }
  };

  const confirmDelete = async () => {
    if (templateToDelete) {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      try {
        await deletePromptTemplate(templateToDelete.id, headers);
        setShowDeleteConfirmation(false);
        setTemplateToDelete(null);
        const updatedPrompts = await fetchPromptTemplates(headers);
        setPrompts(updatedPrompts);
      } catch (error) {
        console.error('Error deleting prompt template:', error);
      }
    }
  };

  if (sessionLoading || isLoading) return <div>Loading prompts...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4">
              <div className="flex gap-4 mb-4">
                <Input
                  type="search"
                  placeholder="Search prompts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                <Select
                  value={selectedCategory || 'all'}
                  onValueChange={(value) => setSelectedCategory(value === 'all' ? null : value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {allCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <PromptTemplateLibrary
              prompts={filteredPrompts}
              onEdit={handleEditPrompt}
              onDelete={handleDeletePrompt}
              onNewSimple={handleNewSimplePrompt}
              onNewComplex={handleNewComplexPrompt}
            />
          </div>
          {/* New Simple Prompt Dialog */}
          <Dialog open={isNewSimplePromptDialogOpen} onOpenChange={setIsNewSimplePromptDialogOpen}>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle className="text-gray-900">New Simple Prompt</DialogTitle>
                <DialogDescription className="text-gray-600">Create a new simple prompt</DialogDescription>
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

          {/* Edit Prompt Dialog */}
          <Dialog open={isEditPromptDialogOpen} onOpenChange={setIsEditPromptDialogOpen}>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle className="text-gray-900">Edit Prompt</DialogTitle>
                <DialogDescription className="text-gray-600">Make changes to your prompt here</DialogDescription>
              </DialogHeader>
              {editingPrompt && (
                <div className="grid gap-4 py-4">
                  <Input
                    placeholder="Title"
                    value={editingPrompt.title}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                    className="border-gray-300"
                  />
                  <Textarea
                    placeholder="Prompt content"
                    value={editingPrompt.prompt as string}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt: e.target.value })}
                    className="border-gray-300"
                  />
                  <Select
                    value={editingPrompt.category}
                    onValueChange={(value) => setEditingPrompt({ ...editingPrompt, category: value })}
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
                  <TagSelector
                    tags={editingPrompt.tags}
                    setTags={(tags) => setEditingPrompt({ ...editingPrompt, tags })}
                    placeholder="Add tags"
                  />
                </div>
              )}
              <DialogFooter>
                <Button onClick={handleSaveEditedPrompt} className="bg-blue-600 hover:bg-blue-700 text-white">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Complex Prompt Editor */}
          {isComplexEditorOpen && (
            <ComplexPromptEditor
              initialData={selectedComplexPrompt?.prompt as PromptContent}
              initialTitle={selectedComplexPrompt?.title || ''}
              initialCategory={selectedComplexPrompt?.categories[0]?.id.toString() || ''}
              initialTags={selectedComplexPrompt?.tags || []}
              onSave={handleSaveComplexPrompt}
              onClose={() => {
                setIsComplexEditorOpen(false);
                setSelectedComplexPrompt(null);
              }}
              categories={categories}
            />
          )}

          <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
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
