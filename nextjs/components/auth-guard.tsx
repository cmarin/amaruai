'use client';

// @ts-nocheck
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { fetchCurrentUser } from '@/utils/user-service';
import { Session } from '@supabase/supabase-js';
import { ApiHeaders } from '@/app/utils/session/session';

// Global variable to track if user status has been checked in this session
let userStatusChecked = false;

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabase();
  const router = useRouter();
  const pathname = usePathname();

  // Handle authentication
  useEffect(() => {
    const handleAuthChange = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      // Reset user status check when a new session starts
      if (!session && userStatusChecked) {
        userStatusChecked = false;
      }

      if (!session) {
        // Reset loading after redirect to avoid flash of protected content
        setTimeout(() => setLoading(false), 100);
        router.push('/auth/login');
      } else {
        setSession(session);
        setLoading(false);
      }
    };

    handleAuthChange();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        router.push('/auth/login');
      } else {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  // Check if user is active
  useEffect(() => {
    const checkUserStatus = async () => {
      // Skip if no session or already checked
      if (!session || userStatusChecked) {
        return;
      }

      try {
        console.log("Checking user active status...");
        
        // Create headers object with the access token
        const headers: ApiHeaders = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        
        const user = await fetchCurrentUser(headers);
        
        // Mark that we've checked the user status for this session
        userStatusChecked = true;
        
        if (!user.active) {
          console.log("User is inactive, redirecting...");
          router.push('/inactive');
        } else {
          console.log("User is active, proceeding...");
        }
      } catch (error) {
        console.error("Error checking user status:", error);
      }
    };

    checkUserStatus();
  }, [session, router, pathname]);

  if (loading) {
    // You can replace this with a proper loading component
    return <div>Loading...</div>;
  }

  return <>{children}</>;
};

export default AuthGuard;
