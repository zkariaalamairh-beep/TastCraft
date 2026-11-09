import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';

// Friendly role groups mapped to the real roles.
const ROLE_SETS = {
  staff: ['Kitchen', 'Manager', 'Owner'],
  management: ['Manager', 'Owner'],
};

export default function RequireRole({ access, children }) {
  const { isAuthenticated, status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="menu-state" role="status">
        <span className="loading-ring" aria-hidden="true" />
        <p>Checking your access...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/signin" state={{ from: location }} replace />
    );
  }

  const allowed =
    ROLE_SETS[access]?.some((role) =>
      user?.roles?.includes(role),
    ) ?? true;

  if (!allowed) {
    return (
      <main className="site-container">
        <div className="menu-state">
          <h2>Access restricted.</h2>
          <p>This area is for staff members only.</p>
        </div>
      </main>
    );
  }

  return children;
}