'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/app/contexts/SupabaseContext';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useSupabase();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        // Check for session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          const currentPath = window.location.pathname;
          router.replace(`/auth/login?returnTo=${encodeURIComponent(currentPath)}`);
          return;
        }
        
        // Additional check for active status
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('active')
          .eq('id', session.user.id)
          .single();
        
        if (userError) {
          console.error('Error checking user status:', userError);
        } else if (user && user.active === false) {
          console.log('User is inactive, redirecting to inactive page');
          router.replace('/inactive');
          return;
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/auth/login');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Recheck active status when auth state changes
        checkAuth();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return <>{children}</>;
}
