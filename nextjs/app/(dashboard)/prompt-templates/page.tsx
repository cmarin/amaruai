'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PromptTemplate, fetchPromptTemplates, createPromptTemplate, updatePromptTemplate, deletePromptTemplate } from '@/components/promptTemplateService';
import { AppSidebar } from '@/components/app-sidebar';
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Code } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import TagSelector from '@/components/tag-selector'
import { Tag } from '@/components/tagService'
import { ComplexPromptEditor, PromptContent } from '@/components/complex-prompt-editor'
import { fetchCategories, Category } from '@/components/categoryService'
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
import { useSidebar } from '@/components/SidebarContext'
import { useSession } from '@/app/utils/session/session';

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
    setSelectedComplexPrompt(null);
    setIsComplexEditorOpen(true);
  };

  const handleEditPrompt = (prompt: PromptTemplate) => {
    if (prompt.is_complex) {
      let complexPromptData: PromptContent;
      if (typeof prompt.prompt === 'string') {
        try {
          complexPromptData = JSON.parse(prompt.prompt);
        } catch (error) {
          console.error('Error parsing complex prompt data:', error);
          complexPromptData = { variables: [], prompt: prompt.prompt };
        }
      } else {
        complexPromptData = prompt.prompt;
      }
      setSelectedComplexPrompt({
        ...prompt,
        prompt: complexPromptData,
      });
      setIsComplexEditorOpen(true);
    } else {
      setEditingPrompt({
        ...prompt,
        category: prompt.categories[0]?.id.toString() || ''
      });
      setIsEditPromptDialogOpen(true);
    }
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
    try {
      await updatePromptTemplate(editingPrompt.id, {
        title: editingPrompt.title,
        prompt: editingPrompt.prompt as string,
        is_complex: false,
        default_persona_id: editingPrompt.default_persona_id || null,  // Add '|| null' here
        category_ids: editingPrompt.category ? [parseInt(editingPrompt.category)] : [],
        tag_ids: editingPrompt.tags.map(t => t.id || t.name),
      });
      setIsEditPromptDialogOpen(false);
      await loadPromptTemplates();
    } catch (error) {
      console.error('Error updating prompt:', error);
    }
  };

  const handleDeleteClick = (template: PromptTemplate) => {
    setTemplateToDelete(template);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (templateToDelete) {
      try {
        await deletePromptTemplate(templateToDelete.id);
        setShowDeleteConfirmation(false);
        setTemplateToDelete(null);
        await loadPromptTemplates();
      } catch (error) {
        console.error('Error deleting prompt template:', error);
      }
    }
  };

  const handleSaveComplexPrompt = async (title: string, category: string, tags: Tag[], complexPromptData: PromptContent) => {
    try {
      if (selectedComplexPrompt) {
        await updatePromptTemplate(selectedComplexPrompt.id, {
          title,
          prompt: JSON.stringify(complexPromptData),
          is_complex: true,
          default_persona_id: selectedComplexPrompt.default_persona_id || null,  // Add '|| null' here
          category_ids: [parseInt(category)],
          tag_ids: tags.map(t => t.id || t.name),
        });
      } else {
        await createPromptTemplate({
          title,
          prompt: JSON.stringify(complexPromptData),
          is_complex: true,
          category_ids: [parseInt(category)],
          tag_ids: tags.map(t => t.id || t.name),
        });
      }
      setIsComplexEditorOpen(false);
      setSelectedComplexPrompt(null);
      await loadPromptTemplates();
    } catch (error) {
      console.error('Error saving complex prompt:', error);
    }
  };

  if (sessionLoading || !initialized) {
    return <div>Loading session...</div>;
  }

  if (isLoading) {
    return <div>Loading prompt templates...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white"> {/* Changed bg-gray-100 to bg-white */}
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="flex items-center justify-between p-4 border-b bg-white">
            <h1 className="text-2xl font-bold">Prompt Templates</h1>
            <div>
              <Button onClick={handleNewSimplePrompt} className="bg-blue-600 hover:bg-blue-700 text-white mr-2">
                <Plus className="mr-2 h-4 w-4" /> Simple Prompt
              </Button>
              <Button onClick={handleNewComplexPrompt} className="bg-green-600 hover:bg-green-700 text-white">
                <Plus className="mr-2 h-4 w-4" /> Complex Prompt
              </Button>
            </div>
          </div>
          <div className="p-4">
            <Input
              type="search"
              placeholder="Search prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
            <ScrollArea className="h-16 mb-4">
              <div className="flex space-x-2">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  onClick={() => setSelectedCategory(null)}
                  className={`mb-2 ${selectedCategory === null ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 border-blue-600 hover:bg-blue-100'}`}
                >
                  All
                </Button>
                {allCategories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    onClick={() => setSelectedCategory(category)}
                    className={`mb-2 ${selectedCategory === category ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 border-blue-600 hover:bg-blue-100'}`}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
          <ScrollArea className="flex-grow">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredPrompts.length > 0 ? (
                filteredPrompts.map((prompt) => (
                  <Card key={prompt.id} className="flex flex-col">
                    <CardContent className="flex-grow p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">{prompt.title}</h3>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditPrompt(prompt)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-100">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteClick(prompt)} 
                            className="text-red-500 hover:text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Category: {prompt.categories.map(category => category.name).join(', ')}</p>
                      {prompt.is_complex ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPrompt(prompt)}
                          className="flex items-center"
                        >
                          <Code className="h-4 w-4 mr-2" />
                          <span>View Complex Prompt</span>
                        </Button>
                      ) : (
                        <p className="text-sm text-gray-600">{(prompt.prompt as string).substring(0, 100)}...</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {prompt.tags.map(tag => (
                          <span key={tag.id} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center text-gray-500">No prompts found</div>
              )}
            </div>
          </ScrollArea>
        </div>
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
  );
}
