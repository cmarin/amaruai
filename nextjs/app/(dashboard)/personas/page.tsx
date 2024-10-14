'use client';

import React, { useState, useEffect } from 'react'
import { fetchPersonas, Persona, deletePersona } from '@/components/personaService'
import PersonaLibrary from '@/components/persona-library'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, Plus, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import PersonaManager from '@/components/persona-manager'
import { Badge } from "@/components/ui/badge"

export default function PersonaPage() {
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

  if (isLoading) return <div>Loading personas...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <PersonaLibrary
      onBack={() => {/* Implement your back logic here */}}
      personas={personas}
      onUpdatePersonas={handleUpdatePersonas}
    />
  )
}
