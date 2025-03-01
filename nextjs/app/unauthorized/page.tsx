'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function UnauthorizedPage() {
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
            <CardTitle className="text-center">Access Denied</CardTitle>
            <p className="text-sm text-muted-foreground text-center">
              You don't have permission to access this page
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                This page requires administrator privileges. If you believe you should have access to this page,
                please contact your administrator.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" asChild>
              <Link href="/">Back to Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 