import React from 'react'

// Catches render crashes and shows a message instead of a blank screen.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 480, margin: '64px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#555', fontSize: 14 }}>{String(this.state.error.message || this.state.error)}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '12px 20px', cursor: 'pointer' }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}
