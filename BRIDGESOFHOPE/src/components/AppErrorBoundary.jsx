import React from 'react';

/**
 * Catches render errors so mobile users see recovery UI instead of a blank white screen.
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[App] Uncaught render error', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleTryAgain = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            boxSizing: 'border-box',
            background: '#f8f9fd',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#1b2559',
          }}
        >
          <div
            style={{
              width: 'min(420px, 100%)',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '24px 22px',
              boxShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
            }}
          >
            <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              Something went wrong
            </h1>
            <p style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.55, color: '#475569' }}>
              The app hit an unexpected error. This can happen on phones after long use or many taps.
              Reloading usually fixes it.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '11px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#f54e25',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Reload app
              </button>
              <button
                type="button"
                onClick={this.handleTryAgain}
                style={{
                  padding: '11px 18px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
