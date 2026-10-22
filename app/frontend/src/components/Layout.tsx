import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <span className="brand">Quote Portal</span>
        <div className="header-user">
          {user && (
            <span data-testid="current-user">
              {user.email} <span className="muted">({user.organisation.name})</span>
            </span>
          )}
          <button type="button" className="btn btn-secondary" data-testid="logout-button" onClick={() => void signOut()}>
            Log out
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
