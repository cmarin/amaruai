'use client';

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation';
import { fetchPersonas, Persona, deletePersona } from '@/components/personaService'
import PersonaLibrary from '@/components/persona-library'
import { AppSidebar } from '@/components/app-sidebar'
import { useSidebar } from '@/components/SidebarContext'

export default function PersonaPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { sidebarOpen } = useSidebar()

  useEffect(() => {
    fetchPersonas()
      .then((data) => {
        setPersonas(data)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching personas:', err)
        setError('Failed to load personas')
        setIsLoading(false)
      })
  }, [])

  const handleUpdatePersonas = async () => {
    try {
      const updatedPersonas = await fetchPersonas()
      setPersonas(updatedPersonas)
    } catch (err) {
      console.error('Error updating personas:', err)
      setError('Failed to update personas')
    }
  }

  const toggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`);
  }

  if (isLoading) return <div>Loading personas...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <AppSidebar toggleChatbot={toggleChatbot} />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <PersonaLibrary
            personas={personas}
            onUpdatePersonas={handleUpdatePersonas}
          />
        </div>
      </div>
    </div>
  )
}
