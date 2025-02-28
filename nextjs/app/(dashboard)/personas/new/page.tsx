'use client';

import { useRouter } from 'next/navigation';
import PersonaManager from '@/components/persona-manager';
import { AppSidebar } from '@/components/app-sidebar';
import { useSidebar } from '@/components/sidebar-context';

export default function NewPersonaPage() {
  const router = useRouter();
  const { sidebarOpen } = useSidebar();

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white dark:bg-gray-900">
        <AppSidebar />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <PersonaManager
            persona={null}
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