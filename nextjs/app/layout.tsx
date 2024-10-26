import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { DataProvider } from '../components/DataContext';
import { SidebarProvider } from '@/components/SidebarContext';  // Import our custom SidebarProvider
import { SupabaseProvider } from '@/app/contexts/SupabaseContext';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AmaruaAI",
  description: "AmaruAI is a platform for next simple agent workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SupabaseProvider>
          <DataProvider>
            <SidebarProvider>
              <div className="flex h-screen w-full">
                {children}
              </div>
            </SidebarProvider>
          </DataProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
