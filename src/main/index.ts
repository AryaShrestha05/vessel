import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { PtyManager } from './pty-manager'

// --- NEW IMPORTS EXPLAINED ---
// `ipcMain` is the main process side of Electron's IPC system.
// It can:
//   ipcMain.handle(channel, handler)  - listen for a request and send a response back
//   ipcMain.on(channel, handler)      - listen for a fire-and-forget message
//
// `PtyManager` is our class that manages terminal shell processes.
// We import it so we can create an instance and call its methods when IPC messages arrive.

// Create ONE PtyManager for the entire app.
// It lives as long as the app is running and manages all terminal sessions.
const ptyManager = new PtyManager()

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// --- IPC HANDLERS ---
// These are like Express route handlers, but instead of HTTP requests,
// they handle messages from the renderer process.
//
// In Express you'd write:
//   app.post('/api/terminal', (req, res) => { ... })
//
// In Electron IPC it's:
//   ipcMain.handle('pty:create', (event, args) => { ... })
//
// The `event` object contains info about who sent the message.
// `event.sender` is the WebContents (the renderer window) that sent it,
// which we need so PtyManager can send shell output BACK to that window.

// 'pty:create' - Renderer asks us to spawn a new terminal shell.
// Uses `handle` (request/response) because the renderer needs the process ID back.
ipcMain.handle('pty:create', (event, { id, cols, rows, cwd }) => {
  return ptyManager.create(id, cols, rows, cwd, event.sender)
})

// 'pty:write' - Renderer sends keystrokes to a terminal.
// Uses `on` (fire-and-forget) because we don't need to respond.
// This fires on every single keypress, so it needs to be fast.
ipcMain.on('pty:write', (_event, { id, data }) => {
  ptyManager.write(id, data)
})

// 'pty:resize' - Renderer tells us a terminal changed size.
// Happens when the user drags a split pane divider or resizes the window.
ipcMain.on('pty:resize', (_event, { id, cols, rows }) => {
  ptyManager.resize(id, cols, rows)
})

// 'pty:destroy' - Renderer tells us to kill a terminal.
// Happens when the user closes a terminal pane or tab.
ipcMain.on('pty:destroy', (_event, { id }) => {
  ptyManager.destroy(id)
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// When the app is about to quit, kill all terminal processes.
// Without this, orphaned shell processes would keep running in the background.
app.on('before-quit', () => {
  ptyManager.destroyAll()
})
