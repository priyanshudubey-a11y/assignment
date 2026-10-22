import { Component, type ReactNode } from 'react';

/** FE-10: generic message only; never a stack trace, SQL text or raw API body. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Intentionally silent: details must not reach the user.
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="boot" role="alert" data-testid="error-boundary">
        <h1>Something went wrong. Try again.</h1>
        <button type="button" className="btn" onClick={() => window.location.assign('/quotes')}>
          Reload
        </button>
      </div>
    );
  }
}
