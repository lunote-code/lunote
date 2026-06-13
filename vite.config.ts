import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lunaDebugLogPlugin } from './scripts/build/vite-luna-debug-log-plugin.ts'
import { PLUGIN_CATALOG_CONFIG } from './src/plugins/pluginCatalogConfig'

// https://vite.dev/config/
export default defineConfig(() => {
  const catalogProxyTarget = PLUGIN_CATALOG_CONFIG.development.proxyTarget
  const catalogBaseUrl = PLUGIN_CATALOG_CONFIG.development.baseUrl.replace(/\/$/, '')
  const enableCatalogProxy = catalogBaseUrl.startsWith('/')

  return {
    plugins: [react(), lunaDebugLogPlugin()],
    server: enableCatalogProxy
      ? {
          proxy: {
            [catalogBaseUrl]: {
              target: catalogProxyTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(new RegExp(`^${catalogBaseUrl}`), ''),
            },
          },
        }
      : undefined,
    build: {
      //Desktop Tauri application; mainly includes editor/Mermaid, etc. The larger size is expected
      chunkSizeWarningLimit: 5000,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          print: resolve(__dirname, 'print.html'),
        },
        output: {
          manualChunks(id) {
            if (id.includes('@uiw/react-codemirror') || id.includes('@codemirror/')) {
              return 'codemirror'
            }
            if (id.includes('react-markdown') || id.includes('remark-gfm')) {
              return 'markdown'
            }
            if (id.includes('node_modules/mermaid')) {
              return 'mermaid-vendor'
            }
            if (id.includes('node_modules/cytoscape')) {
              return 'cytoscape-vendor'
            }
            if (id.includes('/src/app/AppRoot') || id.includes('/src/app/AppRoot.tsx')) {
              return 'app-root'
            }
            return undefined
          },
        },
      },
    },
  }
})
