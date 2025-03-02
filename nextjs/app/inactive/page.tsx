'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useSupabase } from '@/app/contexts/SupabaseContext';
import { useRouter } from 'next/navigation';

export default function InactivePage() {
  const router = useRouter();
  const supabase = useSupabase();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-gray-50 dark:bg-gray-950 p-4">
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
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Account Inactive</h1>
        </div>
        
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 p-8">
          <div className="space-y-6">
            <p className="text-gray-700 dark:text-gray-200">
              Your account has been deactivated. This might be due to:
            </p>
            
            <ul className="list-disc pl-5 text-gray-700 dark:text-gray-200">
              <li>Your account is not active</li>
            </ul>
            
            <p className="text-gray-700 dark:text-gray-200">
              Please contact your administrator or support team to resolve this issue.
            </p>
            
            <div className="pt-4">
              <Button 
                variant="outline" 
                className="w-full dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700" 
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 