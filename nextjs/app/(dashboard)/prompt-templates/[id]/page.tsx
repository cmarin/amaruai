'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PromptTemplate, fetchPromptTemplate } from '@/utils/prompt-template-service';
import { Category, fetchCategories } from '@/utils/category-service';
import PromptTemplateEditor from '@/components/prompt-template-editor';
import ComplexPromptTemplateEditor from '@/components/complex-prompt-template-editor';
import { useSession } from '@/app/utils/session/session';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/components/sidebar-context';
import { AppSidebar } from '@/components/app-sidebar';

export default function PromptTemplatePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { getApiHeaders, initialized } = useSession();
  const { toast } = useToast();
  const [promptTemplate, setPromptTemplate] = useState<PromptTemplate | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { sidebarOpen } = useSidebar();

  useEffect(() => {
    // Don't do anything until session is initialized
    if (!initialized) return;

    const fetchData = async () => {
      try {
        const headers = getApiHeaders();
        if (!headers) {
          router.push('/auth/login');
          return;
        }

        const [template, cats] = await Promise.all([
          fetchPromptTemplate(params.id, headers),
          fetchCategories(headers),
        ]);

        setPromptTemplate(template);
        setCategories(cats);
      } catch (error) {
        console.error('Error fetching prompt template:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch prompt template',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, getApiHeaders, router, toast, initialized]);

  const handleSave = () => {
    router.push('/prompt-templates');
  };

  const handleClose = () => {
    router.push('/prompt-templates');
  };

  // Show loading while session is initializing or data is loading
  if (!initialized || loading) {
    return <div>Loading...</div>;
  }

  if (!promptTemplate) {
    return <div>Prompt template not found</div>;
  }

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center h-screen">Loading...</div>
      ) : promptTemplate ? (
        <div className="flex h-full w-full overflow-hidden bg-white dark:bg-background">
          <AppSidebar />
          <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
            <div className="p-8 pt-12">
              {promptTemplate.is_complex ? (
                <ComplexPromptTemplateEditor
                  promptTemplate={promptTemplate}
                  categories={categories}
                  onSave={handleSave}
                  onClose={() => router.push('/prompt-templates')}
                />
              ) : (
                <PromptTemplateEditor
                  promptTemplate={promptTemplate}
                  categories={categories}
                  onSave={handleSave}
                  onClose={() => router.push('/prompt-templates')}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-screen">Prompt template not found</div>
      )}
    </div>
  );
}