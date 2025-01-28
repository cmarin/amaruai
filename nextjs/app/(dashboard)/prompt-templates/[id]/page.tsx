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
  const { getApiHeaders } = useSession();
  const { toast } = useToast();
  const [promptTemplate, setPromptTemplate] = useState<PromptTemplate | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { sidebarOpen } = useSidebar();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = getApiHeaders();
        if (!headers) {
          toast({
            title: 'Error',
            description: 'You must be logged in to view prompt templates',
            variant: 'destructive',
          });
          router.push('/login');
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
  }, [params.id, getApiHeaders, router, toast]);

  const handleSave = () => {
    router.push('/prompt-templates');
  };

  const handleClose = () => {
    router.push('/prompt-templates');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!promptTemplate) {
    return <div>Prompt template not found</div>;
  }

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            {promptTemplate.is_complex ? (
              <ComplexPromptTemplateEditor
                promptTemplate={promptTemplate}
                categories={categories}
                onSave={handleSave}
                onClose={handleClose}
              />
            ) : (
              <PromptTemplateEditor
                promptTemplate={promptTemplate}
                categories={categories}
                onSave={handleSave}
                onClose={handleClose}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
