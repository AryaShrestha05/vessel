// The root React component. For now it's just a placeholder.
// We'll replace this with the terminal UI in Phase 2.

function App(): React.JSX.Element {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1e1e2e',
      color: '#cdd6f4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1>Vessel</h1>
    </div>
  )
}

export default App
