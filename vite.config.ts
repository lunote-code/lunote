import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lunaDebugLogPlugin } from './scripts/build/vite-luna-debug-log-plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), lunaDebugLogPlugin()],
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
          return undefined
        },
      },
    },
  },
})
