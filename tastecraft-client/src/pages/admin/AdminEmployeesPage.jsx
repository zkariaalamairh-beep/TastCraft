import { useEffect, useState } from 'react';

import { useAuth } from '../../hooks/useAuth.js';
import {
  getStaff,
  createStaff,
  updateStaffRole,
} from '../../services/staff.js';

const ROLE_BADGES = {
  Kitchen: { label: '👨‍🍳 Kitchen', tone: 'tone-gold' },
  Manager: { label: '🧑‍💼 Manager', tone: 'tone-blue' },
  Owner: { label: '👑 Owner', tone: 'tone-green' },
};

function AddStaffModal({ isOwner, onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Kitchen');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError('');

    try {
      await createStaff({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });

      onCreated();
    } catch (createError) {
      setError(
        createError.message ||
          'Unable to create the account.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-heading">
            <h2>Add a team member.</h2>
          </div>

          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="st-name">Full name</label>

            <input
              id="st-name"
              type="text"
              maxLength={100}
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              disabled={busy}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="st-email">Email address</label>

            <input
              id="st-email"
              type="email"
              maxLength={256}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="st-pass">Temporary password</label>

            <input
              id="st-pass"
              type="text"
              minLength={10}
              maxLength={128}
              placeholder="They will change it later"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              disabled={busy}
              required
            />

            <p className="field-help">
              At least 10 characters. Share it privately.
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="st-role">Role</label>

            <select
              id="st-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              disabled={busy}
            >
              <option value="Kitchen">👨‍🍳 Kitchen</option>

              {isOwner && (
                <option value="Manager">🧑‍💼 Manager</option>
              )}
            </select>

            {!isOwner && (
              <p className="field-help">
                Only an Owner can create Manager accounts.
              </p>
            )}
          </div>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="primary-button modal-confirm"
            disabled={busy}
          >
            {busy ? 'Creating...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminEmployeesPage() {
  const { user } = useAuth();

  const isOwner = Boolean(user?.roles?.includes('Owner'));

  const [view, setView] = useState({
    status: 'loading',
    list: [],
    error: '',
  });

  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getStaff()
      .then((data) => {
        if (controller.signal.aborted) return;
        setView({
          status: 'ready',
          list: Array.isArray(data) ? data : [],
          error: '',
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setView({
          status: 'error',
          list: [],
          error: error.message || 'Unable to load the team.',
        });
      });

    return () => controller.abort();
  }, [requestKey]);

  async function changeRole(member, nextRole) {
    if (busyId) return;

    if (
      !window.confirm(
        `Change ${member.fullName} to ${nextRole}? Their next sign-in picks up the new role.`,
      )
    ) {
      return;
    }

    setActionError('');
    setBusyId(member.id);

    try {
      await updateStaffRole(member.id, nextRole);

      setView((current) => ({
        ...current,
        list: current.list.map((currentMember) =>
          currentMember.id === member.id
            ? {
                ...currentMember,
                roles: currentMember.roles.includes('Owner')
                  ? currentMember.roles
                  : [
                      ...currentMember.roles.filter(
                        (role) =>
                          role === 'Kitchen' ||
                          role === 'Manager',
                      ),
                      nextRole,
                    ],
              }
            : currentMember,
        ),
      }));
    } catch (error) {
      setActionError(
        error.message || 'Unable to change the role.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <header className="admin-page-head admin-head-row">
        <div>
          <h1>Team.</h1>
          <p>The people behind every order.</p>
        </div>

        <button
          type="button"
          className="admin-action primary"
          onClick={() => setAdding(true)}
        >
          + Add staff
        </button>
      </header>

      {actionError && (
        <p className="error-message" role="alert">
          {actionError}
        </p>
      )}

      {view.status === 'loading' && (
        <div className="menu-state" role="status">
          <span className="loading-ring" aria-hidden="true" />
          <p>Gathering the team...</p>
        </div>
      )}

      {view.status === 'error' && (
        <div className="menu-state">
          <p role="alert">{view.error}</p>
        </div>
      )}

      {view.status === 'ready' && (
        <div className="staff-list">
          {view.list.map((member) => {
            const isSelf =
              member.email === user?.email;

            const isOwnerAccount = member.roles.includes(
              'Owner',
            );

            return (
              <article
                key={member.id}
                className="staff-card"
              >
                <div className="staff-avatar" aria-hidden="true">
                  {member.fullName
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>

                <div className="staff-info">
                  <h3>
                    {member.fullName}

                    {isSelf && (
                      <small> (you)</small>
                    )}
                  </h3>

                  <p>{member.email}</p>
                </div>

                <div className="staff-badges">
                  {member.roles.map((role) => (
                    <span
                      key={role}
                      className={`status-pill ${
                        ROLE_BADGES[role]?.tone ??
                        'tone-gray'
                      }`}
                    >
                      {ROLE_BADGES[role]?.label ?? role}
                    </span>
                  ))}
                </div>

                <div className="staff-actions">
                  {!isOwnerAccount && !isSelf && isOwner && (
                    <select
                      value={
                        member.roles.includes('Manager')
                          ? 'Manager'
                          : 'Kitchen'
                      }
                      disabled={busyId === member.id}
                      onChange={(event) =>
                        changeRole(member, event.target.value)
                      }
                    >
                      <option value="Kitchen">
                        👨‍🍳 Kitchen
                      </option>

                      <option value="Manager">
                        🧑‍💼 Manager
                      </option>
                    </select>
                  )}
                </div>
              </article>
            );
          })}

          {view.list.length === 0 && (
            <div className="menu-state">
              <h2>No staff yet.</h2>
              <p>Add your first team member.</p>
            </div>
          )}
        </div>
      )}

      {adding && (
        <AddStaffModal
          isOwner={isOwner}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            setRequestKey((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}