'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Category, fetchCategories } from '@/utils/category-service';
import PromptTemplateEditor from '@/components/prompt-template-editor';
import ComplexPromptTemplateEditor from '@/components/complex-prompt-template-editor';
import { useSession } from '@/app/utils/session/session';
import { useToast } from '@/hooks/use-toast';

export default function NewPromptTemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getApiHeaders, initialized } = useSession();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const isComplex = searchParams.get('type') === 'complex';

  useEffect(() => {
    if (!initialized) return;

    const fetchData = async () => {
      try {
        const headers = getApiHeaders();
        if (!headers) {
          router.push('/auth/login');
          return;
        }

        const cats = await fetchCategories(headers);
        setCategories(cats);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch categories',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initialized, getApiHeaders, router, toast]);

  const handleSave = () => {
    router.push('/prompt-templates');
  };

  if (!initialized || loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      {isComplex ? (
        <ComplexPromptTemplateEditor
          categories={categories}
          onSave={handleSave}
          onClose={() => router.push('/prompt-templates')}
          mode="create"
        />
      ) : (
        <PromptTemplateEditor
          categories={categories}
          onSave={handleSave}
          onClose={() => router.push('/prompt-templates')}
          mode="create"
        />
      )}
    </div>
  );
}
