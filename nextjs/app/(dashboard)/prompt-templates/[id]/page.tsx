'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PromptTemplate, fetchPromptTemplate } from '@/utils/prompt-template-service';
import { useSession } from '@/app/utils/session/session';
import { useSidebar } from '@/components/sidebar-context';
import { AppSidebar } from '@/components/app-sidebar';
import PromptTemplateEditor from '@/components/prompt-template-editor';

export default function PromptTemplatePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { getApiHeaders } = useSession();
  const [promptTemplate, setPromptTemplate] = useState<PromptTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { sidebarOpen } = useSidebar();

  useEffect(() => {
    const loadPromptTemplate = async () => {
      try {
        const headers = getApiHeaders();
        if (!headers) return;
        const data = await fetchPromptTemplate(params.id, headers);
        setPromptTemplate(data);
      } catch (error) {
        console.error('Error loading prompt template:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPromptTemplate();
  }, [params.id, getApiHeaders]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            {promptTemplate && (
              <PromptTemplateEditor
                promptTemplate={promptTemplate}
                onSave={() => {
                  router.refresh();
                  router.push('/prompt-templates');
                }}
                onClose={() => router.push('/prompt-templates')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
