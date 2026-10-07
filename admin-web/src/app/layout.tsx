import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { TanStackSorguSaglayicisi } from "@/saglayicilar/tanstack-sorgu-saglayicisi";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TupBayiProje | Merkezi SaaS Yönetimi",
  description: "TupBayiProje merkezi SaaS yönetim uygulaması",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TanStackSorguSaglayicisi>{children}</TanStackSorguSaglayicisi>
      </body>
    </html>
  );
}
