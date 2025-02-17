'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/app/utils/session/session';
import { PromptTemplate, updatePromptTemplate, createPromptTemplate } from '@/utils/prompt-template-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagSelector from '@/components/tag-selector';
import { Tag } from '@/utils/tag-service';
import { Category } from '@/utils/category-service';
import ComplexPromptEditor from '@/components/complex-prompt-editor';
import type { PromptContent } from '@/components/complex-prompt-editor';

interface ComplexPromptTemplateEditorProps {
  promptTemplate?: PromptTemplate;
  categories: Category[];
  onSave: () => void;
  onClose: () => void;
  mode?: 'create' | 'edit';
}

export default function ComplexPromptTemplateEditor({ promptTemplate, categories, onSave, onClose, mode = 'edit' }: ComplexPromptTemplateEditorProps) {
  const { getApiHeaders } = useSession();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (title: string, category: string, tags: Tag[], data: PromptContent, defaultPersonaId: string | null, defaultChatModelId: string | null) => {
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
          prompt: JSON.stringify(data),
          is_complex: true,
          category_ids: [category],
          tags: tags.map(t => t.name),
          default_persona_id: defaultPersonaId,
          default_chat_model_id: defaultChatModelId,
        }, headers);
      } else {
        if (!promptTemplate) return;
        await updatePromptTemplate(promptTemplate.id, {
          title,
          prompt: JSON.stringify(data),
          is_complex: true,
          default_persona_id: defaultPersonaId,
          default_chat_model_id: defaultChatModelId,
          category_ids: [category],
          tags: tags.map(t => t.name),
        }, headers);
      }

      toast({
        title: 'Success',
        description: `Prompt template ${mode === 'create' ? 'created' : 'updated'} successfully`,
      });

      onSave();
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
      <ComplexPromptEditor
        title={promptTemplate?.title}
        initialContent={promptTemplate?.prompt as PromptContent}
        categories={categories}
        selectedCategory={promptTemplate?.categories[0]?.id}
        selectedTags={promptTemplate?.tags || []}
        defaultPersonaId={promptTemplate?.default_persona_id}
        defaultChatModelId={promptTemplate?.default_chat_model_id}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
        mode={mode}
      />
    </div>
  );
}
