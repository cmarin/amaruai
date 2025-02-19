'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/app/utils/session/session';
import { PromptTemplate, updatePromptTemplate, createPromptTemplate } from '@/utils/prompt-template-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagSelector from '@/components/tag-selector';
import { Tag } from '@/utils/tag-service';
import { Category } from '@/utils/category-service';
import { useData } from '@/components/data-context';
import { ComboboxPersonas } from '@/components/combobox-personas';
import { ComboboxChatModels } from '@/components/combobox-chat-models';

interface PromptTemplateEditorProps {
  promptTemplate?: PromptTemplate;
  categories: Category[];
  onSave?: () => void;
  onClose?: () => void;
  mode?: 'create' | 'edit';
}

export default function PromptTemplateEditor({ promptTemplate, categories, onSave, onClose, mode = 'edit' }: PromptTemplateEditorProps) {
  const { getApiHeaders } = useSession();
  const { toast } = useToast();
  const { personas, chatModels } = useData();
  const [title, setTitle] = useState(promptTemplate?.title || '');
  const [prompt, setPrompt] = useState<string>(typeof promptTemplate?.prompt === 'string' ? promptTemplate.prompt : '');
  const [selectedCategory, setSelectedCategory] = useState(promptTemplate?.categories[0]?.id || categories[0]?.id || '');
  const [tags, setTags] = useState<Tag[]>(promptTemplate?.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(promptTemplate?.default_persona_id || '');
  const [selectedChatModelId, setSelectedChatModelId] = useState<string | null>(promptTemplate?.default_chat_model_id || null);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const headers = getApiHeaders();
      if (!headers) {
        toast({
          title: 'Error',
          description: 'You must be logged in to save prompt templates',
          variant: 'destructive',
        });
        return;
      }

      if (mode === 'create') {
        await createPromptTemplate({
          title,
          prompt,
          is_complex: false,
          category_ids: [selectedCategory],
          tags: tags.map(t => t.name),
          default_persona_id: selectedPersonaId || null,
          default_chat_model_id: selectedChatModelId,
        }, headers);
      } else {
        if (!promptTemplate) return;
        await updatePromptTemplate(promptTemplate.id, {
          title,
          prompt,
          is_complex: false,
          default_persona_id: selectedPersonaId || null,
          default_chat_model_id: selectedChatModelId,
          category_ids: [selectedCategory],
          tags: tags.map(t => t.name),
        }, headers);
      }

      toast({
        title: 'Success',
        description: `Prompt template ${mode === 'create' ? 'created' : 'updated'} successfully`,
      });
      onSave?.();
    } catch (error) {
      console.error('Error saving prompt template:', error);
      toast({
        title: 'Error',
        description: `Failed to ${mode === 'create' ? 'create' : 'update'} prompt template`,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{mode === 'create' ? 'Create Prompt Template' : 'Edit Prompt Template'}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <Textarea
            placeholder="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={10}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="w-full">
            <ComboboxPersonas
              personas={personas || []}
              value={selectedPersonaId || undefined}
              onSelect={(persona) => setSelectedPersonaId(persona.id.toString())}
            />
          </div>

          <div className="w-full">
            <ComboboxChatModels
              models={chatModels || []}
              value={selectedChatModelId}
              onSelect={(model) => setSelectedChatModelId(model.id)}
            />
          </div>
        </div>

        <div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <TagSelector
            tags={tags}
            setTags={setTags}
            placeholder="Add tags"
          />
        </div>
      </div>
    </div>
  );
}
