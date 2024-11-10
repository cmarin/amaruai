import type { Metadata } from "next";
import { geistSans, geistMono } from "@/app/fonts";
import "./globals.css";
import { SupabaseProvider } from '@/app/contexts/SupabaseContext';
import { DataProvider } from '@/components/DataContext'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const metadata: Metadata = {
  title: "AmaruAI",
  description: "AmaruAI is a platform for next simple agent workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SupabaseProvider>
          <DataProvider>
            {children}
          </DataProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
