// page.tsx
'use client';

import Image from 'next/image';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/app/utils/supabase/client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Provider, AuthChangeEvent, Session } from '@supabase/supabase-js';

// Component that uses search params
function LoginContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get('returnTo') || '/chat';
  const [view, setView] = useState<'sign_in' | 'sign_up'>('sign_in');

  useEffect(() => {
    if (window.location.hash === '#auth-sign-up') {
      setView('sign_up');
    }
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN') {
          router.push(returnTo);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, supabase.auth, returnTo]);

  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <Image
              src="/images/amaruai_logo.svg"
              alt="AmaruAI Logo"
              fill
              sizes="80px"
              className="object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">AmaruAI</h1>
        </div>
        {/* Apply the custom class here */}
        <div className="bg-white rounded-lg shadow-md p-8 supabase-auth-container">
          <Auth
            supabaseClient={supabase}
            view={view}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#2563eb',
                    brandAccent: '#3b82f6',
                  },
                },
              },
            }}
            providers={['google', 'email'] as Provider[]}
            redirectTo={`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`}
          />
        </div>
      </div>
    </div>
  );
}

// Main login page component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen justify-center items-center bg-gray-100 p-4">
        <div className="w-full max-w-md text-center">
          Loading...
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
