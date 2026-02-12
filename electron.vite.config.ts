import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-vite builds 3 separate bundles:
// 1. main    - the Electron main process (Node.js environment)
// 2. preload - the preload script (bridge between main and renderer)
// 3. renderer - the React app (browser environment)
export default defineConfig({
  main: {
    plugins: [
      // This plugin tells Vite NOT to bundle node_modules for the main process.
      // Native modules like node-pty can't be bundled - they need to be loaded
      // from node_modules at runtime because they contain compiled C++ code (.node files).
      externalizeDepsPlugin()
    ]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [
      // This plugin enables React's JSX transform and Fast Refresh (hot reload)
      react()
    ]
  }
})
