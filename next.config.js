/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // O Vercel corta qualquer request body em 4,5 MB na borda — um limite
      // maior aqui seria ilusório. A action salvarFatura só recebe JSON leve;
      // o PDF nem sobe mais (texto extraído no browser, ver lib/pdf-client).
      bodySizeLimit: '4mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
}

module.exports = nextConfig
