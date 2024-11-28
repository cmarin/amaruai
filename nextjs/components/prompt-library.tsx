import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Star,
  Edit,
  Trash,
  Code,
  Eye,
  Trash2
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PromptTemplate, fetchPromptTemplates, createPromptTemplate, updatePromptTemplate, deletePromptTemplate } from '@/utils/prompt-template-service'
import { Category, fetchCategories } from '../utils/category-service';
import { ComplexPromptEditor, PromptContent } from './complex-prompt-editor';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { EditorView } from '@codemirror/view';
import TagSelector from './tag-selector';
import { Tag } from '../utils/tag-service';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useSession } from '@/app/utils/session/session';

type PromptLibraryProps = {
  onBack: () => void;
  onSelectPrompt: (prompt: PromptTemplate) => void;
  prompts: PromptTemplate[];
  onUpdatePrompts: () => Promise<void>;
}

// Add this type definition at the top of the file
type PromptTemplateWithId = PromptTemplate & { id: number };

export default function PromptLibrary({ onBack, onSelectPrompt, prompts, onUpdatePrompts }: PromptLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isNewSimplePromptDialogOpen, setIsNewSimplePromptDialogOpen] = useState(false)
  const [isEditPromptDialogOpen, setIsEditPromptDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null)
  const [newSimplePrompt, setNewSimplePrompt] = useState({
    title: '',
    prompt: '',
    category: '',
    tags: [] as Tag[],
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [isComplexEditorOpen, setIsComplexEditorOpen] = useState(false)
  const [selectedComplexPrompt, setSelectedComplexPrompt] = useState<PromptTemplate | null>(null)
  const [editingComplexPrompt, setEditingComplexPrompt] = useState<PromptTemplate | null>(null)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<PromptTemplateWithId | null>(null)
  const { getApiHeaders } = useSession();

  const loadCategories = useCallback(async () => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }
      const fetchedCategories = await fetchCategories(headers);
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, [getApiHeaders]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filteredPrompts = prompts.filter(prompt =>
    prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (!selectedCategory || prompt.categories.some(category => category.name === selectedCategory))
  )

  const allCategories = Array.from(new Set(prompts.flatMap((prompt) => prompt.categories.map(category => category.name))));

  const handleNewSimplePrompt = () => {
    setIsNewSimplePromptDialogOpen(true)
  }

  const handleNewComplexPrompt = () => {
    setSelectedComplexPrompt(null)
    setIsComplexEditorOpen(true)
  }

  const handleEditPrompt = (prompt: PromptTemplate) => {
    if (prompt.is_complex) {
      let complexPromptData;
      if (typeof prompt.prompt === 'string') {
        try {
          complexPromptData = JSON.parse(prompt.prompt);
        } catch (error) {
          console.error('Error parsing complex prompt data:', error);
          complexPromptData = { prompt: prompt.prompt, variables: [] };
        }
      } else {
        complexPromptData = prompt.prompt;
      }
      // Set editingComplexPrompt to open the editor directly
      setEditingComplexPrompt({
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
  }

  const handleSaveNewSimplePrompt = async () => {
    if (newSimplePrompt.title.trim() === '' || newSimplePrompt.prompt.trim() === '') {
      console.error('Please fill in both title and content');
      return;
    }

    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      const promptToAdd = {
        title: newSimplePrompt.title.trim(),
        prompt: newSimplePrompt.prompt.trim(),
        is_complex: false,
        category_ids: newSimplePrompt.category ? [parseInt(newSimplePrompt.category)] : [],
        tag_ids: newSimplePrompt.tags.map(tag => tag.id || tag.name),
      };

      const createdPrompt = await createPromptTemplate(promptToAdd, headers);
      setNewSimplePrompt({
        title: '',
        prompt: '',
        category: '',
        tags: [],
      });
      setIsNewSimplePromptDialogOpen(false);
      await onUpdatePrompts();
    } catch (error) {
      console.error('Error saving new prompt:', error);
    }
  };

  const handleSaveEditedPrompt = async () => {
    if (!editingPrompt) return;

    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      const updatedPromptData = {
        title: editingPrompt.title.trim(),
        prompt: editingPrompt.prompt as string,
        is_complex: false,
        default_persona_id: editingPrompt.default_persona_id || null,
        category_ids: editingPrompt.category ? [parseInt(editingPrompt.category)] : [],
        tag_ids: editingPrompt.tags.map(t => t.id || t.name),
      };

      const updatedPrompt = await updatePromptTemplate(editingPrompt.id, updatedPromptData, headers);

      setIsEditPromptDialogOpen(false);
      setEditingPrompt(null);
      await onUpdatePrompts();
    } catch (error) {
      console.error('Error updating prompt:', error);
    }
  };

  const handleDeletePrompt = async (promptId: number) => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      await deletePromptTemplate(promptId, headers);
      await onUpdatePrompts();
    } catch (error) {
      console.error('Error deleting prompt:', error);
    }
  };

  const handleSaveComplexPrompt = async (title: string, category: string, tags: Tag[], complexPromptData: PromptContent) => {
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        return;
      }

      let savedPrompt: PromptTemplate;
      const promptToUpdate = selectedComplexPrompt || editingComplexPrompt;
      if (promptToUpdate) {
        savedPrompt = await updatePromptTemplate(promptToUpdate.id, {
          title: title,
          prompt: JSON.stringify(complexPromptData),
          is_complex: true,
          default_persona_id: promptToUpdate.default_persona_id || null,
          category_ids: [parseInt(category)],
          tag_ids: tags.map(t => t.id || t.name),
        }, headers);
      } else {
        savedPrompt = await createPromptTemplate({
          title: title,
          prompt: JSON.stringify(complexPromptData),
          is_complex: true,
          category_ids: [parseInt(category)],
          tag_ids: tags.map(t => t.id || t.name),
        }, headers);
      }
      setIsComplexEditorOpen(false);
      setSelectedComplexPrompt(null);
      setEditingComplexPrompt(null);
      await onUpdatePrompts();
    } catch (error) {
      console.error('Error saving complex prompt:', error);
    }
  }

  const handleViewComplexPrompt = (prompt: PromptTemplate) => {
    setSelectedComplexPrompt(prompt);
  };

  const handleDeleteClick = (template: PromptTemplateWithId) => {
    setTemplateToDelete(template);
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (templateToDelete) {
      try {
        const headers = getApiHeaders();
        if (!headers) {
          console.error('No valid headers available');
          return;
        }

        await deletePromptTemplate(templateToDelete.id, headers);
        setShowDeleteAlert(false);
        setTemplateToDelete(null);
        await onUpdatePrompts();
      } catch (error) {
        console.error('Error deleting prompt template:', error);
      }
    }
  };

  const handleCategoryClick = (category: Category) => {
    // existing code
  }

  const handleTagClick = (t: Tag) => {
    // existing code
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" onClick={onBack} className="mr-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Prompt Library</h1>
        <div>
          <Button onClick={handleNewSimplePrompt} className="bg-blue-600 hover:bg-blue-700 text-white mr-2">
            <Plus className="mr-2 h-4 w-4" />
            Prompt
          </Button>
          <Button onClick={handleNewComplexPrompt} className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Complex Prompt
          </Button>
        </div>
      </div>

      {/* Search and Category Filters */}
      <div className="p-4">
        <Input
          type="text"
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

      {/* Prompt List */}
      <ScrollArea className="flex-grow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {filteredPrompts.map(prompt => (
            <div key={prompt.id} className="border rounded-lg p-4 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold">{prompt.title}</h3>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEditPrompt(prompt)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-100">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(prompt)} className="text-red-500 hover:text-red-700 hover:bg-red-100">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">Category: {prompt.categories.map(category => category.name).join(', ')}</p>
              <div className="text-sm text-gray-600 mb-4 flex-grow">
                {prompt.is_complex ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewComplexPrompt(prompt)}
                    className="flex items-center"
                  >
                    <Code className="h-4 w-4 mr-2" />
                    <span>View Complex Prompt</span>
                  </Button>
                ) : (
                  <p>{prompt.prompt as string}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {prompt.tags.map(tag => (
                  <span key={tag.id} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Complex Prompt Dialog */}
      <Dialog open={!!selectedComplexPrompt} onOpenChange={() => setSelectedComplexPrompt(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-white">
          <DialogHeader>
            <DialogTitle>{selectedComplexPrompt?.title}</DialogTitle>
            <DialogDescription>
              Preview of the complex prompt structure.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="mt-4 h-[400px]">
            <div className="pr-4"> {/* Add right padding for scrollbar */}
              <CodeMirror
                value={JSON.stringify(selectedComplexPrompt?.prompt, null, 2)}
                height="100%"
                extensions={[
                  json(),
                  EditorView.lineWrapping, // Enable line wrapping
                ]}
                theme={vscodeDark}
                editable={false}
                readOnly={true}
                className="border border-gray-300 rounded-md"
              />
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setSelectedComplexPrompt(null)} className="bg-blue-600 hover:bg-blue-700 text-white">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isComplexEditorOpen && (
        <ComplexPromptEditor
          initialData={
            selectedComplexPrompt || editingComplexPrompt
              ? (selectedComplexPrompt || editingComplexPrompt)?.prompt as PromptContent
              : undefined
          }
          initialTitle={
            selectedComplexPrompt?.title || editingComplexPrompt?.title || ''
          }
          initialCategory={
            (selectedComplexPrompt || editingComplexPrompt)?.categories[0]?.id.toString() || ''
          }
          initialTags={
            (selectedComplexPrompt || editingComplexPrompt)?.tags || []
          }
          onSave={handleSaveComplexPrompt}
          onClose={() => {
            setIsComplexEditorOpen(false);
            setSelectedComplexPrompt(null);
            setEditingComplexPrompt(null);
          }}
          categories={categories}
        />
      )}

      {/* New Simple Prompt Dialog */}
      <Dialog open={isNewSimplePromptDialogOpen} onOpenChange={setIsNewSimplePromptDialogOpen}>
        <DialogContent className="bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-black">New Simple Prompt</DialogTitle>
            <DialogDescription>
              Create a new simple prompt by filling out the form below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="title" className="text-right text-gray-700">
                Title
              </label>
              <Input
                id="title"
                value={newSimplePrompt.title}
                onChange={(e) => setNewSimplePrompt({ ...newSimplePrompt, title: e.target.value })}
                className="col-span-3 border-gray-300 text-black"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="content" className="text-right">
                Content
              </label>
              <Textarea
                id="content"
                value={newSimplePrompt.prompt}
                onChange={(e) => setNewSimplePrompt({ ...newSimplePrompt, prompt: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="category" className="text-right text-gray-700">
                Category
              </label>
              <Select
                value={newSimplePrompt.category}
                onValueChange={(value) => setNewSimplePrompt({ ...newSimplePrompt, category: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category: Category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="tags" className="text-right text-gray-700">
                Tags
              </label>
              <div className="col-span-3">
                <TagSelector
                  tags={newSimplePrompt.tags}
                  setTags={(tags) => setNewSimplePrompt({ ...newSimplePrompt, tags })}
                  placeholder="Add a prompt tag"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSaveNewSimplePrompt} className="bg-blue-600 hover:bg-blue-700 text-white">
              Save Simple Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Prompt Dialog */}
      <Dialog open={isEditPromptDialogOpen} onOpenChange={setIsEditPromptDialogOpen}>
        <DialogContent className="bg-white text-black">
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
            <DialogDescription>
              Make changes to your prompt here.
            </DialogDescription>
          </DialogHeader>
          {editingPrompt && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="edit-title" className="text-right">
                  Title
                </label>
                <Input
                  id="edit-title"
                  value={editingPrompt.title}
                  onChange={(e) => {
                    setEditingPrompt({ ...editingPrompt, title: e.target.value })
                  }}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="edit-content" className="text-right">
                  Content
                </label>
                <Textarea
                  id="edit-content"
                  value={editingPrompt.prompt as string}
                  onChange={(e) => {
                    setEditingPrompt({ ...editingPrompt, prompt: e.target.value })
                  }}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="edit-category" className="text-right text-gray-700">
                  Category
                </label>
                <Select
                  value={editingPrompt.category}
                  onValueChange={(value) => setEditingPrompt({ ...editingPrompt, category: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category: Category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="edit-tags" className="text-right text-gray-700">
                  Tags
                </label>
                <div className="col-span-3">
                  <TagSelector
                    tags={editingPrompt.tags}
                    setTags={(tags) => setEditingPrompt({ ...editingPrompt, tags })}
                    placeholder="Add a prompt tag"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={handleSaveEditedPrompt} className="bg-blue-600 hover:bg-blue-700 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showDeleteAlert && (
        <Alert>
          <AlertTitle>Are you sure you want to delete this prompt template?</AlertTitle>
          <AlertDescription>
            This action cannot be undone. The prompt template will be permanently deleted.
          </AlertDescription>
          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowDeleteAlert(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </Alert>
      )}
    </div>
  )
}
