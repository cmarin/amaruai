import type { Metadata } from "next";
import { geistSans, geistMono } from "@/app/fonts";
import "./globals.css";
import { SupabaseProvider } from '@/app/contexts/SupabaseContext';
import { DataProvider } from '@/components/data-context'
import { createClient } from '@supabase/supabase-js'
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SupabaseProvider>
            <DataProvider>
              {children}
            </DataProvider>
          </SupabaseProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
