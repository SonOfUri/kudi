import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";

import { QueryProvider } from "@/components/query-provider";

import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kudi",
  description: "Earn yield without the crypto complexity.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} min-h-dvh bg-white antialiased`}>
      <body className="bg-white font-sans text-foreground">
        <QueryProvider>
          <div className="relative mx-auto flex min-h-dvh w-full  flex-col bg-surface">
            {children}
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
