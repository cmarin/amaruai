'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { useSupabase } from '@/app/contexts/SupabaseContext';

export type ApiHeaders = {
  'Content-Type': string;
  'Accept': string;
  'Authorization': string;
}

export function useSession() {
  const supabase = useSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const getSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (mounted) {
          console.log('Current session:', currentSession);
          setSession(currentSession);
          setInitialized(true);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        console.log('Auth state changed, new session:', newSession);
        setSession(newSession);
        setInitialized(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const getApiHeaders = useCallback((): ApiHeaders | null => {
    if (!initialized || !session?.access_token) {
      console.warn('Session not initialized or no access token available');
      return null;
    }

    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }, [initialized, session?.access_token]);

  const value = useMemo(() => ({
    session,
    loading: loading || !initialized,
    accessToken: session?.access_token,
    getApiHeaders,
    initialized
  }), [session, loading, initialized, getApiHeaders]);

  return value;
}