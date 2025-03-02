'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { fetchCurrentUser } from '@/utils/user-service';
import { useSession } from '@/app/utils/session/session';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useSupabase();
  const { getApiHeaders, session } = useSession();
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const currentPath = window.location.pathname;
        router.replace(`/auth/login?returnTo=${encodeURIComponent(currentPath)}`);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/auth/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase.auth]);

  // Check if user is active
  useEffect(() => {
    const checkUserStatus = async () => {
      if (!session || isCheckingUser) return;
      
      try {
        setIsCheckingUser(true);
        const headers = getApiHeaders();
        
        if (!headers) {
          console.warn('No headers available to check user status');
          return;
        }
        
        const user = await fetchCurrentUser(headers);
        
        if (!user.active) {
          console.log('User is inactive, redirecting to /inactive');
          router.replace('/inactive');
        }
      } catch (error) {
        console.error('Error checking user status:', error);
      } finally {
        setIsCheckingUser(false);
      }
    };
    
    checkUserStatus();
  }, [session, getApiHeaders, router, isCheckingUser]);

  return <>{children}</>;
}
