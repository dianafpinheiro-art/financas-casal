import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Finanças do Casal 💜",
  description: "Divisão inteligente de despesas do cartão de crédito",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-background text-foreground flex h-screen overflow-hidden print:overflow-visible print:bg-white print:text-black`}>
        <div className="print:hidden">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0 print:block print:w-full">
          <div className="print:hidden">
            <Header />
          </div>
          <main className="flex-1 overflow-y-auto p-6 bg-muted/20 print:p-0 print:bg-white print:overflow-visible">
            <div className="max-w-6xl mx-auto print:max-w-none">
              {children}
            </div>
          </main>
        </div>
        <div className="print:hidden">
          <Toaster />
        </div>
      </body>
    </html>
  )
}
