import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { resolveNext } from '../lib/redirect';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { status, user, signIn } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // The one and only post-login navigation: once the user is known, replace-navigate to a whitelisted target.
  // Also covers a signed-in user opening /login (Q-P5: goes to the quote list, or a valid `next`).
  if (status === 'authenticated' && user) {
    return <Navigate to={resolveNext(params.get('next'))} replace />;
  }
  if (status === 'loading') {
    return (
      <div className="boot" role="status" data-testid="app-loading">
        Loading…
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return; // double click / double Enter sends one request
    setFormError('');
    const eErr = email.length === 0 ? 'Enter your email.' : EMAIL_RE.test(email) ? '' : 'Enter a valid email address.';
    const pErr = password.length === 0 ? 'Enter your password.' : '';
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) {
      (eErr ? emailRef : passwordRef).current?.focus();
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      await signIn(email, password); // email sent exactly as typed
    } catch (err) {
      inFlight.current = false;
      setSubmitting(false);
      if (err instanceof ApiError && err.status === 401) setFormError('Incorrect email or password.');
      else if (err instanceof ApiError && err.status === 400) setFormError('Check your email and password and try again.');
      else setFormError('Something went wrong. Try again.');
      emailRef.current?.focus();
    }
  }

  return (
    <main className="login-wrap" id="main">
      <form className="card login-card" onSubmit={onSubmit} noValidate method="post" aria-labelledby="login-title" data-testid="login-form">
        <h1 id="login-title">Sign in</h1>
        {formError && (
          <p className="form-error" role="alert" data-testid="login-error">
            {formError}
          </p>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            ref={emailRef}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? 'email-error' : undefined}
            data-testid="login-email"
          />
          {emailError && (
            <p className="field-error" id="email-error" role="alert" data-testid="login-email-error">
              {emailError}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            ref={passwordRef}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? 'password-error' : undefined}
            data-testid="login-password"
          />
          {passwordError && (
            <p className="field-error" id="password-error" role="alert" data-testid="login-password-error">
              {passwordError}
            </p>
          )}
        </div>
        <button type="submit" className="btn" disabled={submitting} data-testid="login-submit">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
