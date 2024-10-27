import React from 'react';  // Add React import
import type { Metadata } from "next";
import { geistSans, geistMono } from "../fonts";  // Fix the path to be relative
import "../globals.css";

export const metadata: Metadata = {
  title: "AmaruAI - Authentication",
  description: "Sign in or sign up to AmaruAI",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {children}
    </div>
  );
}
