'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Category, fetchCategories } from '@/utils/category-service';
import PromptTemplateEditor from '@/components/prompt-template-editor';
import ComplexPromptTemplateEditor from '@/components/complex-prompt-template-editor';
import { useSession } from '@/app/utils/session/session';
import { useToast } from '@/hooks/use-toast';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';

export default function NewPromptTemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getApiHeaders, initialized } = useSession();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const isComplex = searchParams.get('type') === 'complex';
  const { sidebarOpen } = useSidebar();

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
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-background">
      <AppSidebar />
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-[250px]' : 'ml-16'}`}>
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
    </div>
  );
}
