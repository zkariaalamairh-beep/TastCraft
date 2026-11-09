import { useEffect, useState } from 'react';

import { authRequest } from '../../services/auth.js';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function AdminDashboardPage() {
  const [view, setView] = useState({
    status: 'loading',
    data: null,
    error: '',
  });

  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setView((current) => ({ ...current, status: 'loading' }));

    authRequest('/dashboard/summary', {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setView({ status: 'ready', data, error: '' });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setView((current) => ({
          ...current,
          status: 'error',
          error: error.message || 'Unable to load the dashboard.',
        }));
      });

    return () => controller.abort();
  }, [requestKey]);

  if (view.status === 'loading') {
    return (
      <div className="menu-state" role="status">
        <span className="loading-ring" aria-hidden="true" />
        <p>Loading the numbers...</p>
      </div>
    );
  }

  if (view.status === 'error') {
    return (
      <div className="menu-state">
        <p role="alert">{view.error}</p>
        <button
          type="button"
          className="site-button button-green"
          onClick={() => setRequestKey((v) => v + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  const s = view.data;

   const cards = [
    { label: 'Orders today', value: s.todayOrders, icon: '📅', tone: 'gold' },
    { label: 'New orders', value: s.pendingOrders, icon: '🕐', tone: 'gold' },
    { label: 'Cooking now', value: s.preparingOrders, icon: '🔥', tone: 'red' },
    { label: 'Ready', value: s.readyOrders, icon: '✅', tone: 'green' },
    { label: 'Completed total', value: priceFormatter.format(s.completedOrdersTotal), icon: '💰', tone: 'green' },
    { label: 'Completed orders', value: s.completedOrders, icon: '🎉', tone: 'blue' },
    { label: 'Cancelled', value: s.cancelledOrders, icon: '❌', tone: 'gray' },
    { label: 'Menu items', value: `${s.availableMenuItems} / ${s.totalMenuItems}`, icon: '🍕', tone: 'blue' },
    { label: 'Categories', value: s.totalCategories, icon: '📂', tone: 'blue' },
    {
      label: 'Average rating',
      value: s.averageRating ? `${s.averageRating.toFixed(1)} ★` : '—',
      icon: '⭐',
      tone: 'gold',
    },
  ];

  return (
    <section>
      <header className="admin-page-head">
        <h1>Dashboard.</h1>
        <p>The restaurant at a glance.</p>
      </header>

      <div className="stat-grid">
        {cards.map((card) => (
          <article
            key={card.label}
            className={`stat-card tone-${card.tone}`}
          >
            <span className="stat-icon" aria-hidden="true">
              {card.icon}
            </span>

            <span className="stat-value">{card.value}</span>

            <span className="stat-label">{card.label}</span>
          </article>
        ))}
      </div>
    </section>
  );
}