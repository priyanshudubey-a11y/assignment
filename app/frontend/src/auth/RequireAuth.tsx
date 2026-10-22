import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { loginPathFor } from '../lib/redirect';
import { Layout } from '../components/Layout';

/** Auth guard: no protected content (and no layout) until the session is known. */
export function RequireAuth() {
  const { status, loggedOut, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="boot" role="status" data-testid="app-loading">
        Loading…
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="boot" role="alert" data-testid="app-error">
        <p>Something went wrong. Try again.</p>
        <button type="button" className="btn" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }
  if (status === 'anonymous') {
    return <Navigate to={loggedOut ? '/login' : loginPathFor(location)} replace />;
  }
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
