import { app, BrowserWindow } from 'electron'
import { join } from 'path'

// `app` is the Electron application object. It controls your app's lifecycle.
// Think of it as the "process manager" - it fires events like:
//   'ready'            - Electron has finished initializing, safe to create windows
//   'window-all-closed' - all windows are closed (quit the app on Windows/Linux)
//   'activate'         - macOS dock icon clicked (recreate window if none exist)

// `BrowserWindow` is the class that creates actual desktop windows.
// Each BrowserWindow runs its own renderer process (a Chromium tab).

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // On macOS, 'hiddenInset' hides the default title bar but keeps the
    // traffic light buttons (close/minimize/maximize) inset into the window.
    // This gives us a clean frameless look while keeping native controls.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      // The preload script runs BEFORE the renderer page loads.
      // It has access to both Node.js APIs and the DOM.
      // We use it as a secure bridge to expose specific main-process
      // functionality to the renderer via contextBridge.
      preload: join(__dirname, '../preload/index.js'),

      // contextIsolation: true means the preload script runs in its own
      // JavaScript context, separate from the renderer page. This prevents
      // the renderer from accessing Node.js APIs directly - it can only
      // use what we explicitly expose via contextBridge.
      contextIsolation: true,

      // nodeIntegration: false means the renderer page can NOT use
      // require() or any Node.js APIs. This is a security best practice.
      // If a malicious website somehow got loaded in your app, it couldn't
      // access the file system or run commands.
      nodeIntegration: false,

      // sandbox: false is needed because our preload script imports from
      // electron (contextBridge, ipcRenderer). Sandboxed preload scripts
      // have limited API access.
      sandbox: false
    }
  })

  // In development, load from the Vite dev server (with hot reload).
  // In production, load the built HTML file from disk.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// app.whenReady() returns a Promise that resolves when Electron is fully
// initialized. You MUST wait for this before creating any BrowserWindows.
app.whenReady().then(() => {
  createWindow()

  // macOS specific: when the dock icon is clicked and no windows are open,
  // create a new window. This is standard macOS app behavior.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// On Windows and Linux, quit the app when all windows are closed.
// On macOS, apps typically stay running in the dock even with no windows.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
