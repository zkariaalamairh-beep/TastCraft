import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth.js';

export default function AdminLayout() {
  const { user } = useAuth();

  const isOwner = Boolean(
    user?.roles?.includes('Owner'),
  );

  const navClass = ({ isActive }) =>
    isActive ? 'admin-nav-link active' : 'admin-nav-link';

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            TC
          </span>

          <div>
            <strong>Staff Console</strong>
            <small>Taste Craft</small>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Admin">
          <NavLink to="/admin" end className={navClass}>
            📊 Dashboard
          </NavLink>

          <NavLink to="/admin/orders" className={navClass}>
            🧾 Orders
          </NavLink>

          <NavLink to="/admin/menu" className={navClass}>
            🍕 Menu
          </NavLink>

          {isOwner && (
            <NavLink to="/admin/team" className={navClass}>
              👥 Team
            </NavLink>
          )}
        </nav>

        <p className="admin-sidebar-note">
          {isOwner
            ? 'Owner console — full access.'
            : 'Staff console.'}
        </p>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}