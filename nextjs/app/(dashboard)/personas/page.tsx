'use client';

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation';
import { fetchPersonas, Persona, deletePersona } from '@/components/personaService'
import PersonaLibrary from '@/components/persona-library'

export default function PersonaPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const handleBack = () => {
    router.push('/chat');
  };

  if (isLoading) return <div>Loading personas...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <PersonaLibrary
      onBack={handleBack}
      personas={personas}
      onUpdatePersonas={handleUpdatePersonas}
    />
  )
}
