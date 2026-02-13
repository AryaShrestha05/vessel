// This is the entry point for the React app.
// It finds the <div id="root"> in index.html and mounts our React component tree into it.

import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

// NOTE: We intentionally do NOT use <React.StrictMode> here.
// StrictMode runs every useEffect twice in development to help find bugs.
// But our terminal hook spawns real OS processes - double-mounting would
// create a shell, immediately kill it, then create another one.
// This causes the terminal to show "[Process exited with code 0]" on startup.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
