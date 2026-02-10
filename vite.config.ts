import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_PUBLIC_BASE || (isProd ? '/lovers-message/' : '/')

  return {
    base,
    server: {
      port: 3000,
      host: '0.0.0.0'
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            cloudbase: ['@cloudbase/js-sdk'],
            icons: ['lucide-react']
          }
        }
      }
    }
  }
})
