'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/app/utils/session/session';
import { PromptTemplate, updatePromptTemplate } from '@/utils/prompt-template-service';

interface PromptTemplateEditorProps {
  promptTemplate: PromptTemplate;
  onSave?: () => void;
  onClose?: () => void;
}

export default function PromptTemplateEditor({ promptTemplate, onSave, onClose }: PromptTemplateEditorProps) {
  const { getApiHeaders } = useSession();
  const { toast } = useToast();
  const [title, setTitle] = useState(promptTemplate.title);
  const [prompt, setPrompt] = useState(promptTemplate.prompt);
  const [isSaving, setIsSaving] = useState(false);

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

      await updatePromptTemplate(promptTemplate.id, {
        title,
        prompt,
        is_complex: promptTemplate.is_complex,
        default_persona_id: promptTemplate.default_persona_id || null,
        category_ids: promptTemplate.categories.map(c => c.id),
        tags: promptTemplate.tags.map(t => t.name),
      }, headers);

      toast({
        title: 'Success',
        description: 'Prompt template saved successfully',
      });

      onSave?.();
    } catch (error) {
      console.error('Error saving prompt template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save prompt template',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Edit Prompt Template</h2>
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
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="prompt" className="text-sm font-medium">
            Prompt
          </label>
          <Textarea
            id="prompt"
            value={typeof prompt === 'string' ? prompt : JSON.stringify(prompt, null, 2)}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter prompt"
            className="min-h-[200px]"
          />
        </div>
      </div>
    </div>
  );
}
