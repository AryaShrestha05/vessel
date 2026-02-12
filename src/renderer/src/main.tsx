// This is the entry point for the React app.
// It finds the <div id="root"> in index.html and mounts our React component tree into it.

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
