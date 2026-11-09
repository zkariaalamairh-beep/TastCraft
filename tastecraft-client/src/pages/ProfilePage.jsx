import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { changePassword } from '../services/auth.js';
import { useAuth } from '../hooks/useAuth.js';

const ROLE_BADGES = {
  Kitchen: { label: '👨‍🍳 Kitchen', tone: 'tone-gold' },
  Manager: { label: '🧑‍💼 Manager', tone: 'tone-blue' },
  Owner: { label: '👑 Owner', tone: 'tone-green' },
  Customer: { label: '🧑 Customer', tone: 'tone-gray' },
};

// Inline eye toggle for a single password input.
function PasswordToggle({
  visible,
  onToggle,
  inputId,
}) {
  return (
    <button
      type="button"
      className="password-eye"
      aria-label={
        visible ? 'Hide password' : 'Show password'
      }
      aria-pressed={visible}
      aria-controls={inputId}
      onClick={onToggle}
    >
      {visible ? '🙈' : '👁️'}
    </button>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const initials = (user?.fullName ?? 'TC')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isStaff = Boolean(
    user?.roles?.includes('Kitchen') ||
      user?.roles?.includes('Manager') ||
      user?.roles?.includes('Owner'),
  );

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy) return;

    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('Choose a different new password.');
      return;
    }

    setBusy(true);

    try {
      await changePassword({
        currentPassword,
        newPassword,
      });

      // The API revoked every session — sign out locally too.
      setDone(true);

      setTimeout(async () => {
        try {
          await logout();
        } finally {
          navigate('/signin');
        }
      }, 2500);
    } catch (changeError) {
      setError(
        changeError.message ||
          'Unable to change the password.',
      );
      setBusy(false);
    }
  }

  return (
    <main className="profile-page site-container">
      {/* ===== Identity banner ===== */}
      <section
        className={`profile-banner ${
          isStaff ? 'profile-banner-staff' : ''
        }`}
      >
        <span className="profile-avatar" aria-hidden="true">
          {initials}
        </span>

        <div className="profile-banner-info">
          <p className="eyebrow">
            {isStaff ? 'STAFF ACCOUNT' : 'YOUR ACCOUNT'}
          </p>

          <h1>{user?.fullName}</h1>

          <p className="profile-banner-email">
            {user?.email}
          </p>

          <div className="profile-banner-roles">
            {user?.roles?.map((role) => (
              <span
                key={role}
                className={`status-pill ${
                  ROLE_BADGES[role]?.tone ?? 'tone-gray'
                }`}
              >
                {ROLE_BADGES[role]?.label ?? role}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="profile-layout">
        {/* ===== Password card ===== */}
        <section className="profile-card">
          <h2>🔐 Change password</h2>

          {done ? (
            <div className="profile-done" role="status">
              <span className="profile-done-icon">
                ✅
              </span>

              <h3>Password changed</h3>

              <p>
                Every session was signed out for your
                security. Redirecting you to sign in
                again...
              </p>
            </div>
          ) : (
            <form
              className="profile-form"
              onSubmit={handleSubmit}
              aria-busy={busy}
            >
              <div className="form-field">
                <label htmlFor="cur-pass">
                  Current password
                </label>

                <div className="password-wrap">
                  <input
                    id="cur-pass"
                    type={
                      showCurrent ? 'text' : 'password'
                    }
                    autoComplete="current-password"
                    maxLength={128}
                    value={currentPassword}
                    onChange={(event) =>
                      setCurrentPassword(event.target.value)
                    }
                    disabled={busy}
                    required
                  />

                  <PasswordToggle
                    inputId="cur-pass"
                    visible={showCurrent}
                    onToggle={() =>
                      setShowCurrent((value) => !value)
                    }
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="new-pass">
                  New password
                </label>

                <div className="password-wrap">
                  <input
                    id="new-pass"
                    type={
                      showNew ? 'text' : 'password'
                    }
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(event.target.value)
                    }
                    disabled={busy}
                    required
                  />

                  <PasswordToggle
                    inputId="new-pass"
                    visible={showNew}
                    onToggle={() =>
                      setShowNew((value) => !value)
                    }
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="conf-pass">
                  Confirm new password
                </label>

                <div className="password-wrap">
                  <input
                    id="conf-pass"
                    type={
                      showConfirm ? 'text' : 'password'
                    }
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    disabled={busy}
                    required
                  />

                  <PasswordToggle
                    inputId="conf-pass"
                    visible={showConfirm}
                    onToggle={() =>
                      setShowConfirm((value) => !value)
                    }
                  />
                </div>

                <p className="field-help">
                  At least 10 characters — same policy
                  as sign-up.
                </p>
              </div>

              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="primary-button profile-submit"
                disabled={busy}
              >
                {busy
                  ? 'Changing...'
                  : 'Change password'}
              </button>

              <p className="field-help profile-logout-note">
                🔒 Changing your password signs you out
                on every device.
              </p>
            </form>
          )}
        </section>

        {/* ===== Info card ===== */}
        <section className="profile-card profile-info-card">
          <h2>📌 Account info</h2>

          <ul className="profile-facts">
            <li>
              <span className="profile-fact-icon">
                🧑
              </span>

              <div>
                <strong>Full name</strong>
                <p>{user?.fullName}</p>
              </div>
            </li>

            <li>
              <span className="profile-fact-icon">
                ✉️
              </span>

              <div>
                <strong>Email address</strong>
                <p>{user?.email}</p>
              </div>
            </li>

            <li>
              <span className="profile-fact-icon">
                🛡️
              </span>

              <div>
                <strong>Access level</strong>
                <p>
                  {isStaff
                    ? 'Staff console access enabled.'
                    : 'Ordering and reviews.'}
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}