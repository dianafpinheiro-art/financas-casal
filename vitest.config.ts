import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Config do vitest pros testes da camada de domínio (código puro).
// Roda em ambiente node (sem DOM) porque domain/ não toca em React/Next.
// O alias '@' espelha o tsconfig pra os testes importarem como o app importa.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  // Domínio é código puro, não tem CSS. Passar um postcss inline vazio impede
  // o Vite de procurar/carregar o postcss.config.js (Tailwind/autoprefixer) nos testes.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
