'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { Session } from '@supabase/supabase-js';

export function UserStatusSync() {
  const router = useRouter();
  const supabase = useSupabase();

  // Function to sync user status with the database
  const syncUserStatus = async (session: Session | null) => {
    if (!session) return;

    try {
      // Call the API route to sync user status
      const response = await fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to sync user status:', await response.text());
        return;
      }

      const data = await response.json();
      
      // If user is inactive, redirect to inactive page
      if (data.success && data.active === false) {
        // Only redirect if we're not already on the inactive or auth page
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/auth') && currentPath !== '/inactive') {
          console.log('User is inactive, redirecting to inactive page from sync component');
          router.push('/inactive');
        }
      }
    } catch (error) {
      console.error('Error syncing user status:', error);
    }
  };

  useEffect(() => {
    // Check current session on component mount
    const initialCheck = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      syncUserStatus(session);
    };

    initialCheck();

    // Set up listener for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          syncUserStatus(session);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  // This component doesn't render anything
  return null;
} 