import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/components/providers/auth-provider'
import { FocusReloadPreventer } from '@/components/focus-reload-preventer'

const inter = Inter({ subsets: ["latin"] });

// Force Vercel deployment: 2025-09-24

export const metadata: Metadata = {
  title: "ERP System",
  description: "Inventory-focused ERP system with purchase orders, sales orders, and integrations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <FocusReloadPreventer />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
