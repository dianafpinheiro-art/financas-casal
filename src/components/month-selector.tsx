"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function MonthSelector({ currentMonth }: { currentMonth: string }) {
  const router = useRouter()
  
  const handleValueChange = (value: string | null) => {
    if (!value) return
    // Navigate to the current page with the new month parameter
    router.push(`/?mes=${value}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Mês de Referência:</span>
      <Select value={currentMonth} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[180px] bg-white">
          <SelectValue placeholder="Selecione o mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="2026-04">Abril 2026</SelectItem>
          <SelectItem value="2026-05">Maio 2026</SelectItem>
          <SelectItem value="2026-06">Junho 2026</SelectItem>
          <SelectItem value="2026-07">Julho 2026</SelectItem>
          <SelectItem value="2026-08">Agosto 2026</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
