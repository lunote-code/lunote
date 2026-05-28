import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    //Desktop Tauri application; mainly includes editor/Mermaid, etc. The larger size is expected
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
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
