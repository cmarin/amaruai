'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/utils/session/session';
import { Category, fetchCategories, createCategory, updateCategory, deleteCategory } from '@/utils/category-service';
import { ChatModel, fetchChatModels, createChatModel, updateChatModel, deleteChatModel, favoriteChatModel, unfavoriteChatModel } from '@/utils/chat-model-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Settings2, Star, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';

export default function SettingsPage() {
  const { getApiHeaders, loading: sessionLoading, initialized } = useSession();
  const { sidebarOpen } = useSidebar();
  const [categories, setCategories] = useState<Category[]>([]);
  const [chatModels, setChatModels] = useState<ChatModel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedChatModel, setSelectedChatModel] = useState<ChatModel | null>(null);
  const [isNewCategoryDialogOpen, setIsNewCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [isNewChatModelDialogOpen, setIsNewChatModelDialogOpen] = useState(false);
  const [newChatModel, setNewChatModel] = useState({ 
    name: '', 
    max_tokens: 1,
    description: '' 
  });
  const { toast } = useToast();

  useEffect(() => {
    if (initialized && !sessionLoading) {
      loadData();
    }
  }, [initialized, sessionLoading]);

  const loadData = async () => {
    const headers = getApiHeaders();
    if (!headers) return;

    try {
      const [categoriesData, chatModelsData] = await Promise.all([
        fetchCategories(headers),
        fetchChatModels(headers)
      ]);
      setCategories(categoriesData);
      setChatModels(chatModelsData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load settings data",
        variant: "destructive",
      });
    }
  };

  const handleCreateCategory = async () => {
    const headers = getApiHeaders();
    if (!headers) return;

    try {
      await createCategory(newCategory, headers);
      setIsNewCategoryDialogOpen(false);
      setNewCategory({ name: '', description: '' });
      loadData();
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCategory = async (id: string, data: Partial<Category>) => {
    const headers = getApiHeaders();
    if (!headers) return;

    try {
      await updateCategory(id, data, headers);
      loadData();
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const headers = getApiHeaders();
    if (!headers) return;

    try {
      await deleteCategory(id, headers);
      loadData();
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  const handleUpdateChatModel = async (id: string, data: Partial<ChatModel>) => {
    const headers = getApiHeaders();
    if (!headers) return;

    try {
      await updateChatModel(id, data, headers);
      loadData();
      toast({
        title: "Success",
        description: "Chat model updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update chat model",
        variant: "destructive",
      });
    }
  };

  const handleDeleteChatModel = async (id: string) => {
    const headers = getApiHeaders();
    if (!headers) return;

    try {
      await deleteChatModel(id, headers);
      loadData();
      toast({
        title: "Success",
        description: "Chat model deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete chat model",
        variant: "destructive",
      });
    }
  };

  const handleCreateChatModel = async () => {
    const headers = getApiHeaders();
    if (!headers) return;

    try {
      await createChatModel(newChatModel, headers);
      setIsNewChatModelDialogOpen(false);
      setNewChatModel({ name: '', max_tokens: 1, description: '' });
      loadData();
      toast({
        title: "Success",
        description: "Chat model created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create chat model",
        variant: "destructive",
      });
    }
  };

  const handleToggleFavorite = async (modelId: string, isFavorite: boolean) => {
    const headers = getApiHeaders();
    if (!headers) {
      console.error('No valid headers available');
      return;
    }

    try {
      if (isFavorite) {
        await unfavoriteChatModel(modelId, headers);
      } else {
        await favoriteChatModel(modelId, headers);
      }
      loadData();
      toast({
        title: "Success",
        description: `Chat model ${isFavorite ? 'unfavorited' : 'favorited'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "Error",
        description: `Failed to ${isFavorite ? 'unfavorite' : 'favorite'} chat model`,
        variant: "destructive",
      });
    }
  };

  if (sessionLoading || !initialized) {
    return (
      <div className="flex h-screen">
        <AppSidebar />
        <div className={`flex-1 flex items-center justify-center transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="text-center">
            <h2 className="text-lg font-semibold">Loading...</h2>
            <p className="text-muted-foreground">Please wait while we load your settings</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className={`flex-1 overflow-auto transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="container mx-auto py-6 px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Manage your categories and chat models</p>
            </div>
          </div>

          <Tabs defaultValue="categories">
            <TabsList>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="chat-models">Chat Models</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="mt-6">
              <div className="flex justify-end mb-4">
                <Dialog open={isNewCategoryDialogOpen} onOpenChange={setIsNewCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      New Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Category</DialogTitle>
                      <DialogDescription>Add a new category to organize your content</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={newCategory.name}
                          onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                          placeholder="Category name"
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={newCategory.description}
                          onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                          placeholder="Category description"
                        />
                      </div>
                      <Button onClick={handleCreateCategory}>Create Category</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <Card key={category.id}>
                    <CardHeader>
                      <CardTitle>{category.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setSelectedCategory(category);
                          }}
                        >
                          <Settings2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteCategory(category.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="chat-models" className="mt-6">
              <div className="flex justify-end mb-4">
                <Dialog open={isNewChatModelDialogOpen} onOpenChange={setIsNewChatModelDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      New Chat Model
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Chat Model</DialogTitle>
                      <DialogDescription>Add a new chat model to generate text</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={newChatModel.name}
                          onChange={(e) => setNewChatModel({ ...newChatModel, name: e.target.value })}
                          placeholder="Chat model name"
                        />
                      </div>
                      <div>
                        <Label>Max Tokens</Label>
                        <Input
                          type="number"
                          min="1"
                          value={newChatModel.max_tokens}
                          onChange={(e) =>
                            setNewChatModel({
                              ...newChatModel,
                              max_tokens: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={newChatModel.description}
                          onChange={(e) =>
                            setNewChatModel({
                              ...newChatModel,
                              description: e.target.value,
                            })
                          }
                          placeholder="Model description"
                        />
                      </div>
                      <Button onClick={handleCreateChatModel}>Create Chat Model</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {chatModels.map((model) => (
                  <Card key={model.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle>{model.name}</CardTitle>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleFavorite(model.id, model.is_favorite || false)}
                        >
                          {model.is_favorite ? (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ) : (
                            <Star className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedChatModel(model)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteChatModel(model.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <Label>Max Tokens: {model.max_tokens}</Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Edit Category Dialog */}
          <Dialog open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Category</DialogTitle>
                <DialogDescription>Update category details</DialogDescription>
              </DialogHeader>
              {selectedCategory && (
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={selectedCategory.name}
                      onChange={(e) =>
                        setSelectedCategory({ ...selectedCategory, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={selectedCategory.description}
                      onChange={(e) =>
                        setSelectedCategory({ ...selectedCategory, description: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    onClick={() => {
                      handleUpdateCategory(selectedCategory.id, {
                        name: selectedCategory.name,
                        description: selectedCategory.description,
                      });
                      setSelectedCategory(null);
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Chat Model Dialog */}
          <Dialog open={!!selectedChatModel} onOpenChange={() => setSelectedChatModel(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Chat Model</DialogTitle>
                <DialogDescription>Update chat model settings</DialogDescription>
              </DialogHeader>
              {selectedChatModel && (
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={selectedChatModel.name}
                      onChange={(e) =>
                        setSelectedChatModel({ ...selectedChatModel, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      min="1"
                      value={selectedChatModel.max_tokens}
                      onChange={(e) =>
                        setSelectedChatModel({
                          ...selectedChatModel,
                          max_tokens: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={selectedChatModel.description}
                      onChange={(e) =>
                        setSelectedChatModel({
                          ...selectedChatModel,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <Button
                    onClick={() => {
                      handleUpdateChatModel(selectedChatModel.id, {
                        name: selectedChatModel.name,
                        max_tokens: selectedChatModel.max_tokens,
                        description: selectedChatModel.description,
                      });
                      setSelectedChatModel(null);
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
