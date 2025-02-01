'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Persona, fetchPersona } from '@/utils/persona-service';
import PersonaManager from '@/components/persona-manager';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { useSession } from '@/app/utils/session/session';

export default function PersonaPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { getApiHeaders } = useSession();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { sidebarOpen } = useSidebar();

  useEffect(() => {
    const loadPersona = async () => {
      try {
        const headers = getApiHeaders();
        if (!headers) return;
        const data = await fetchPersona(params.id, headers);
        setPersona(data);
      } catch (error) {
        console.error('Error loading persona:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersona();
  }, [params.id, getApiHeaders]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <PersonaManager
            persona={persona}
            onSave={() => {
              router.refresh();
              router.push('/personas');
            }}
            onClose={() => router.push('/personas')}
          />
        </div>
      </div>
    </div>
  );
}
