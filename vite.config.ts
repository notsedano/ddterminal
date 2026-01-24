import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@assets': path.resolve(__dirname, './assets'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        // Proxy Sportradar API calls for local development
        '/api/sportradar': {
          target: 'https://api.sportradar.com',
          changeOrigin: true,
          rewrite: (path) => {
            // Transform /api/sportradar/nba/... to /nba/...
            const newPath = path.replace('/api/sportradar', '')
            // Append API key
            const separator = newPath.includes('?') ? '&' : '?'
            return `${newPath}${separator}api_key=${env.VITE_SPORTRADAR_API_KEY}`
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Accept', 'application/json')
            })
          },
        },
        // Proxy Polymarket Gamma API for local development
        '/api/polymarket/gamma': {
          target: 'https://gamma-api.polymarket.com',
          changeOrigin: true,
          rewrite: (path) => path.replace('/api/polymarket/gamma', ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Accept', 'application/json')
            })
          },
        },
        // Proxy Polymarket CLOB API for local development
        '/api/polymarket/clob': {
          target: 'https://clob.polymarket.com',
          changeOrigin: true,
          rewrite: (path) => path.replace('/api/polymarket/clob', ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Accept', 'application/json')
            })
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/dist/',
        ],
      },
    },
  }
})
