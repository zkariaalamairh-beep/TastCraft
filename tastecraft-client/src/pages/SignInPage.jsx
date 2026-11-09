import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { apiRequest } from '../services/api.js';

export default function SignInPage() {
  const {
    status,
    user,
    error: sessionError,
    isLoading,
    isAuthenticated,
    login,
    logout,
    retrySession,
  } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isBusy = pendingAction !== null;

  function clearPasswordFields() {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }

  function switchForm() {
    if (isBusy) return;

    setIsRegistering((value) => !value);
    setActionError('');
    setSuccessMessage('');
    clearPasswordFields();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isBusy) return;

    setActionError('');
    setSuccessMessage('');

    if (isRegistering) {
      if (fullName.trim().length < 2) {
        setActionError(
          'Please enter a full name with at least 2 characters.',
        );
        return;
      }

      if (password !== confirmPassword) {
        setActionError('Passwords do not match.');
        return;
      }
    }

    setPendingAction(isRegistering ? 'register' : 'login');

    try {
      if (isRegistering) {
        // Public registration creates a Customer account only.
        await apiRequest('/auth/register', {
          method: 'POST',
          body: {
            fullName: fullName.trim(),
            email: email.trim(),
            password,
          },
        });

        // Registration does not automatically sign the user in.
        setIsRegistering(false);
        setFullName('');
        setEmail(email.trim());

        clearPasswordFields();

        setSuccessMessage(
          'Account created successfully. Sign in to continue.',
        );
      } else {
        await login({
          email: email.trim(),
          password,
        });

        clearPasswordFields();
      }
    } catch (error) {
      setActionError(
        error.message || 'Unable to complete your request.',
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSignOut() {
    if (isBusy) return;

    setActionError('');
    setSuccessMessage('');
    setPendingAction('logout');

    try {
      await logout();

      setIsRegistering(false);
      clearPasswordFields();
    } catch (error) {
      setActionError(error.message || 'Unable to sign out.');
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRetry() {
    setActionError('');
    setSuccessMessage('');

    try {
      await retrySession();
    } catch (error) {
      setActionError(
        error.message || 'Unable to restore your session.',
      );
    }
  }

  let content;

  if (isLoading) {
    content = (
      <div className="session-state" role="status">
        <span className="loading-ring" aria-hidden="true" />

        <h2>A moment, please.</h2>

        <p className="muted">
          We&apos;re restoring your session.
        </p>
      </div>
    );
  } else if (status === 'error') {
    content = (
      <div className="session-state">
        <p className="eyebrow">LET&apos;S RECONNECT</p>

        <h2>Something went wrong.</h2>

        <p className="muted" role="alert">
          {sessionError || 'Unable to connect. Please try again.'}
        </p>

        <button
          type="button"
          className="primary-button"
          onClick={handleRetry}
        >
          Try again
        </button>
      </div>
    );
  } else if (isAuthenticated) {
    content = (
      <div className="session-state">
        <p className="eyebrow">YOU&apos;RE SIGNED IN</p>

        <h2>Welcome, {user.fullName}.</h2>

        <p className="muted">
          Your Taste Craft account is ready.
        </p>

       <dl className="account-details">
  <div>
    <dt>Full name</dt>
    <dd>{user.fullName}</dd>
  </div>

  <div>
    <dt>Email address</dt>
    <dd>{user.email}</dd>
  </div>
</dl>

        <button
          type="button"
          className="primary-button"
          disabled={isBusy}
          onClick={handleSignOut}
        >
          {pendingAction === 'logout'
            ? 'Signing out...'
            : 'Sign out'}
        </button>
      </div>
    );
  } else {
    content = (
      <>
        <p className="eyebrow">
          {isRegistering
            ? 'JOIN TASTE CRAFT'
            : 'YOUR TASTE CRAFT ACCOUNT'}
        </p>

        <h2>
          {isRegistering
            ? 'Create your account.'
            : 'Welcome back.'}
        </h2>

        <p className="muted auth-description">
          {isRegistering
            ? 'Order your favourites and keep track of every order.'
            : 'Sign in and pick up where you left off.'}
        </p>

        {successMessage && (
          <p className="success-message" role="status">
            {successMessage}
          </p>
        )}

        <form
          className="signin-form"
          onSubmit={handleSubmit}
          aria-busy={isBusy}
        >
          {isRegistering && (
            <div className="form-field">
              <label htmlFor="fullName">Full name</label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                disabled={isBusy}
                required
              />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="email">Email address</label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete={isRegistering ? 'email' : 'username'}
              placeholder="you@example.com"
              maxLength={256}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isBusy}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>

            <div className="password-field">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={
                  isRegistering
                    ? 'new-password'
                    : 'current-password'
                }
                placeholder={
                  isRegistering
                    ? 'Create a strong password'
                    : 'Enter your password'
                }
                minLength={isRegistering ? 10 : undefined}
                maxLength={128}
                aria-describedby={
                  isRegistering ? 'password-help' : undefined
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                disabled={isBusy}
                required
              />

              <button
                type="button"
                className="password-toggle"
                aria-label={
                  showPassword ? 'Hide password' : 'Show password'
                }
                aria-pressed={showPassword}
                disabled={isBusy}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {isRegistering && (
              <p id="password-help" className="field-help">
                Use at least 10 characters, including uppercase
                and lowercase letters, a number, and a symbol.
              </p>
            )}
          </div>

          {isRegistering && (
            <div className="form-field">
              <label htmlFor="confirmPassword">
                Confirm password
              </label>

              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Enter your password again"
                minLength={10}
                maxLength={128}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                disabled={isBusy}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={isBusy}
          >
            {isBusy
              ? isRegistering
                ? 'Creating account...'
                : 'Signing in...'
              : isRegistering
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegistering
            ? 'Already have an account?'
            : "Don't have an account?"}{' '}

          <button
            type="button"
            className="text-button"
            disabled={isBusy}
            onClick={switchForm}
          >
            {isRegistering ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </>
    );
  }

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="Taste Craft">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            TC
          </span>

          <span className="brand-name">
            TASTE CRAFT
            <small>Good food. Beautiful moments.</small>
          </span>
        </div>

        <div className="story-copy">
          <p className="eyebrow">A LITTLE INDULGENCE</p>

          <h1>
            Good taste.
            <br />
            <em>Great moments.</em>
          </h1>

          <p>
            Explore the menu, find your favourites, and make your
            next meal something to look forward to.
          </p>
        </div>

        <p className="story-footer">
          Thoughtfully crafted. Ready for pickup.
        </p>
      </section>

      <section className="auth-panel" aria-label="Account access">
        <div
          className="auth-card"
          aria-busy={isLoading || isBusy}
        >
          {content}

          {actionError && (
            <p className="error-message" role="alert">
              {actionError}
            </p>
          )}
        </div>

        <p className="panel-footer">
          TASTE CRAFT · A little more than a meal.
        </p>
      </section>
    </main>
  );
}