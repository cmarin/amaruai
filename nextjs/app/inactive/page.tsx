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
    <div className="flex flex-col min-h-screen justify-center items-center bg-gray-100 dark:bg-gray-900 p-4">
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
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Account Inactive</h1>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <div className="space-y-6">
            <p className="text-gray-600 dark:text-gray-300">
              Your account has been deactivated. This might be due to:
            </p>
            
            <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300">
              <li>Your subscription has expired</li>
              <li>An administrator has disabled your account</li>
              <li>A billing issue needs to be resolved</li>
            </ul>
            
            <p className="text-gray-600 dark:text-gray-300">
              Please contact your administrator or support team to resolve this issue.
            </p>
            
            <div className="pt-4">
              <Button 
                variant="outline" 
                className="w-full" 
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