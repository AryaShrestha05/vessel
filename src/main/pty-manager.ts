// PtyManager - The heart of Vessel's backend
//
// This class manages real terminal shell processes using node-pty.
//
// node-pty creates "pseudo-terminals" (PTYs). A PTY is an OS-level concept:
// it's a pair of virtual devices that simulate a real terminal. One end is
// the "master" (our app reads/writes here) and the other is the "slave"
// (the shell process reads/writes here). This is the same mechanism that
// Terminal.app, iTerm2, and VS Code's terminal use under the hood.
//
// Each terminal session gets a unique ID (UUID). The renderer creates terminals
// by sending an IPC message with an ID, and we spawn a PTY process for it.
// When the shell outputs text, we forward it to the renderer. When the user
// types, the renderer forwards keystrokes to us, and we write them to the PTY.

import * as pty from 'node-pty'
import { WebContents } from 'electron'
import { platform } from 'os'

interface PtySession {
  process: pty.IPty      // The node-pty process instance
  webContents: WebContents // Reference to the renderer window, so we can send data back
}

export class PtyManager {
  // Map of terminal ID -> PTY session
  // We use a Map because we need fast lookup by ID when forwarding keystrokes
  private sessions = new Map<string, PtySession>()

  /**
   * Spawn a new terminal shell process.
   *
   * @param id - Unique identifier for this terminal (UUID from the renderer)
   * @param cols - Number of columns (characters wide) - xterm.js tells us this
   * @param rows - Number of rows (lines tall) - xterm.js tells us this
   * @param cwd - Working directory to start in (defaults to home)
   * @param sender - The renderer's WebContents so we can send data back to it
   * @returns The OS process ID of the spawned shell
   */
  create(
    id: string,
    cols: number,
    rows: number,
    cwd: string | undefined,
    sender: WebContents
  ): { pid: number } {
    // Determine which shell to use:
    // - macOS/Linux: use the user's default shell (usually zsh or bash)
    // - Windows: use PowerShell
    const shell = platform() === 'win32'
      ? 'powershell.exe'
      : process.env.SHELL || '/bin/zsh'

    // pty.spawn() creates the pseudo-terminal and starts the shell.
    // Arguments:
    //   shell  - path to the shell executable
    //   []     - arguments to pass to the shell (none for interactive mode)
    //   opts   - configuration object
    const ptyProcess = pty.spawn(shell, [], {
      // 'xterm-256color' tells the shell what kind of terminal it's running in.
      // This enables 256 colors, cursor movement, and other terminal features.
      // Programs like vim, htop, etc. check this value to know what they can do.
      name: 'xterm-256color',

      // Terminal dimensions - must match what xterm.js is displaying
      cols,
      rows,

      // Starting directory
      cwd: cwd || process.env.HOME || '/',

      // Pass through the current environment variables (PATH, HOME, etc.)
      // The shell needs these to find executables, know the user, etc.
      env: process.env as Record<string, string>
    })

    // Store the session so we can look it up later for write/resize/destroy
    this.sessions.set(id, { process: ptyProcess, webContents: sender })

    // --- Data flow: PTY -> Renderer ---
    // When the shell outputs text (command output, prompts, etc.),
    // forward it to the renderer so xterm.js can display it.
    ptyProcess.onData((data: string) => {
      // Check if the renderer window is still alive (user might have closed it)
      if (!sender.isDestroyed()) {
        sender.send('pty:data', { id, data })
      }
    })

    // --- Exit handling ---
    // When the shell process exits (user types 'exit', or process is killed),
    // notify the renderer so it can show an exit message.
    ptyProcess.onExit(({ exitCode }) => {
      if (!sender.isDestroyed()) {
        sender.send('pty:exit', { id, exitCode })
      }
      // Clean up our reference
      this.sessions.delete(id)
    })

    return { pid: ptyProcess.pid }
  }

  /**
   * Write data (keystrokes) to a terminal.
   * Called when the user types in xterm.js.
   */
  write(id: string, data: string): void {
    this.sessions.get(id)?.process.write(data)
  }

  /**
   * Resize a terminal. Called when the user resizes a split pane
   * or the window. We need to tell the PTY the new dimensions so
   * programs like vim know how many characters fit on screen.
   */
  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.process.resize(cols, rows)
  }

  /**
   * Kill a terminal process and clean up.
   */
  destroy(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.process.kill()
      this.sessions.delete(id)
    }
  }

  /**
   * Kill all terminal processes. Called when the app is quitting.
   */
  destroyAll(): void {
    for (const [id] of this.sessions) {
      this.destroy(id)
    }
  }
}
