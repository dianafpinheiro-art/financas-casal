"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md">
      <Printer className="mr-2 h-4 w-4" /> Imprimir Relatório
    </Button>
  )
}
