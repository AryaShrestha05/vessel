import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// --- IMPORTS EXPLAINED ---
// `contextBridge` - safely exposes objects from preload to the renderer
// `ipcRenderer`   - sends messages TO the main process and listens for messages FROM it
// `IpcRendererEvent` - TypeScript type for the event object in IPC callbacks
//                      We don't actually use the event data, but the callback
//                      receives it as the first argument, so we need the type.

contextBridge.exposeInMainWorld('terminalAPI', {

  // --- CREATE ---
  // Ask the main process to spawn a new shell.
  // Returns a Promise that resolves with { pid: number } once the shell is running.
  //
  // `invoke` = request/response pattern.
  // It sends a message on the 'pty:create' channel and WAITS for the main process
  // to return a value. In main/index.ts, `ipcMain.handle('pty:create', ...)` handles
  // this and returns { pid }.
  //
  // The renderer will call this like:
  //   const { pid } = await window.terminalAPI.create('some-id', 80, 24)
  create: (id: string, cols: number, rows: number, cwd?: string) => {
    return ipcRenderer.invoke('pty:create', { id, cols, rows, cwd })
  },

  // --- WRITE ---
  // Send keystrokes to a terminal.
  //
  // `send` = fire-and-forget pattern.
  // We don't wait for a response because keystrokes need to be fast.
  // If we used `invoke` (which waits), there would be a tiny delay on every keypress.
  //
  // The renderer will call this like:
  //   window.terminalAPI.write('some-id', 'ls\n')
  write: (id: string, data: string) => {
    ipcRenderer.send('pty:write', { id, data })
  },

  // --- RESIZE ---
  // Tell a terminal that its dimensions changed.
  // Fire-and-forget because we don't need confirmation.
  resize: (id: string, cols: number, rows: number) => {
    ipcRenderer.send('pty:resize', { id, cols, rows })
  },

  // --- DESTROY ---
  // Tell the main process to kill a terminal.
  destroy: (id: string) => {
    ipcRenderer.send('pty:destroy', { id })
  },

  // --- ON DATA ---
  // Listen for shell output coming FROM the main process.
  //
  // Remember in pty-manager.ts we have:
  //   sender.send('pty:data', { id, data })
  // That sends a message from main -> renderer. Here we listen for it.
  //
  // This function takes a callback and returns a cleanup function.
  // The cleanup function removes the listener (important to prevent memory leaks
  // when a React component unmounts).
  //
  // The renderer will use this like:
  //   const unsubscribe = window.terminalAPI.onData((id, data) => {
  //     terminal.write(data)  // write shell output into xterm.js
  //   })
  //   // later, to stop listening:
  //   unsubscribe()
  onData: (callback: (id: string, data: string) => void) => {
    const handler = (_event: IpcRendererEvent, { id, data }: { id: string; data: string }) => {
      callback(id, data)
    }
    ipcRenderer.on('pty:data', handler)
    // Return a function that removes this listener
    return () => {
      ipcRenderer.removeListener('pty:data', handler)
    }
  },

  // --- ON EXIT ---
  // Listen for terminal process exits.
  // Same pattern as onData - takes a callback, returns a cleanup function.
  onExit: (callback: (id: string, exitCode: number) => void) => {
    const handler = (_event: IpcRendererEvent, { id, exitCode }: { id: string; exitCode: number }) => {
      callback(id, exitCode)
    }
    ipcRenderer.on('pty:exit', handler)
    return () => {
      ipcRenderer.removeListener('pty:exit', handler)
    }
  }
})
