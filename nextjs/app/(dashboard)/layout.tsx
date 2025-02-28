import type { Metadata } from "next";
import { geistSans, geistMono } from "@/app/fonts";  // Import from fonts.ts
import { DataProvider } from '../../components/data-context';
import { SidebarProvider } from '@/components/sidebar-context';
import { SupabaseProvider } from '@/app/contexts/SupabaseContext';
import { AuthGuard } from '@/components/auth-guard';

export const metadata: Metadata = {
  title: "AmaruaAI",
  description: "AmaruAI is a platform for next simple agent workflows.",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
      <SupabaseProvider>
        <DataProvider>
          <SidebarProvider>
            <AuthGuard>
              <div className="flex min-h-screen w-full bg-background dark:bg-background">
                {children}
              </div>
            </AuthGuard>
          </SidebarProvider>
        </DataProvider>
      </SupabaseProvider>
    </div>
  );
}
