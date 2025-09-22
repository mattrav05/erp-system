import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/components/providers/auth-provider'

const inter = Inter({ subsets: ["latin"] });

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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
