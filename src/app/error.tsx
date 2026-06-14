'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md w-full p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-center space-y-4">
        <h2 className="text-xl font-bold text-destructive">Um erro inesperado aconteceu!</h2>
        <p className="text-sm text-foreground/80 break-words">{error.message}</p>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium shadow-sm hover:opacity-90" onClick={() => reset()}>Tentar Novamente</button>
      </div>
    </div>
  )
}
