import { Link, NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import { useCart } from '../context/CartContext.jsx';

export default function SiteHeader() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { count } = useCart();

  const navigate = useNavigate();

  const isStaff = Boolean(
    user?.roles?.includes('Kitchen') ||
      user?.roles?.includes('Manager') ||
      user?.roles?.includes('Owner'),
  );

  function navClass({ isActive }) {
    return `site-nav-link${isActive ? ' is-active' : ''}`;
  }

  // Scrolls to the reviews section on the home page.
  function goToReviews(event) {
    event.preventDefault();

    navigate('/');

    // Wait a moment for the home page to mount.
    setTimeout(() => {
      document
        .getElementById('guest-reviews')
        ?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  }

  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <Link
          to="/"
          className="site-brand"
          aria-label="Taste Craft home"
        >
          <span className="site-brand-mark" aria-hidden="true">
            TC
          </span>

          <span>
            <strong>TASTE CRAFT</strong>
            <small>Good food. Beautiful moments.</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>

          <NavLink to="/menu" className={navClass}>
            Menu
          </NavLink>

                  <NavLink to="/reviews" className={navClass}>
            ⭐ Reviews
          </NavLink>

          {isAuthenticated && (
            <NavLink to="/orders" className={navClass}>
              My orders
            </NavLink>
          )}

          {isStaff && (
            <NavLink to="/admin" className={navClass}>
              {user.roles.includes('Kitchen')
                ? '👨‍🍳 Kitchen'
                : '👑 Staff'}
            </NavLink>
          )}

                   {isAuthenticated ? (
            <NavLink to="/profile" className={navClass}>
              My account
            </NavLink>
          ) : (
            <NavLink to="/signin" className={navClass}>
              {isLoading ? 'Account' : 'Sign in'}
            </NavLink>
          )}

          <NavLink
            to="/cart"
            className={navClass}
            aria-label="Shopping cart"
          >
            🛒{count > 0 ? ` ${count}` : ''}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}