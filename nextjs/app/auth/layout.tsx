import type { Metadata } from "next";
import { inter } from "@/app/fonts";
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
    <div className={inter.className}>
      {children}
    </div>
  );
}
