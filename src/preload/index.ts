// The preload script is the BRIDGE between the main process and the renderer.
//
// Why do we need this?
// - The renderer (React app) runs in a browser-like sandbox for security
// - It can NOT directly call Node.js APIs or talk to the main process
// - The preload script has access to BOTH worlds:
//   1. Electron's IPC (to talk to the main process)
//   2. contextBridge (to safely expose functions to the renderer)
//
// Think of it as a receptionist: the renderer asks for something,
// the preload forwards the request to the main process, and relays
// the response back.

import { contextBridge } from 'electron'

// contextBridge.exposeInMainWorld() makes an object available on `window`
// in the renderer. The renderer can then call window.terminalAPI.someMethod().
// Importantly, the renderer can NOT access ipcRenderer directly - only the
// specific functions we expose here.
contextBridge.exposeInMainWorld('terminalAPI', {
  // We'll add terminal IPC methods here in Phase 2
})
