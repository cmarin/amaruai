'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function InactivePage() {
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
              className="object-contain dark:invert"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">AmaruAI</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Account Pending Activation</CardTitle>
            <p className="text-sm text-muted-foreground text-center">
              Your account is waiting for administrator approval
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Thank you for creating an account. Your access is currently restricted because an administrator
                needs to activate your account before you can proceed.
              </p>
              <p className="text-muted-foreground">
                Please check back later or contact support if you believe this is an error.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" asChild>
              <Link href="/auth/login">Back to Login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 