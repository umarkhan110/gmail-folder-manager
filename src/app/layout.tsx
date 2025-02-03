// src/app/layout.tsx
'use client'
import './globals.css'
import { NextAuthProvider } from './providers'
import { Toaster } from 'react-hot-toast'
import { cn } from "@/lib/utils"
import { fontSans } from "@/lib/fonts"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        fontSans.variable
      )}>
        <div className="relative flex min-h-screen flex-col">
          <div className="flex-1 border-0">
            <div className="container p-4">
              <NextAuthProvider>{children}</NextAuthProvider>
            </div>
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  )
}