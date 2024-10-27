import type { Metadata } from "next";
import { geistSans, geistMono } from "@/app/fonts";  // Import from fonts.ts
import "../globals.css";
import { DataProvider } from '../../components/DataContext';
import { SidebarProvider } from '@/components/SidebarContext';
import { SupabaseProvider } from '@/app/contexts/SupabaseContext';

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
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <SupabaseProvider>
        <DataProvider>
          <SidebarProvider>
            <div className="flex h-screen w-full">
              {children}
            </div>
          </SidebarProvider>
        </DataProvider>
      </SupabaseProvider>
    </div>
  );
}
