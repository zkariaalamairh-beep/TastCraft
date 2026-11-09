import { useEffect, useState } from 'react';

import { authRequest } from '../../services/auth.js';
import { useAuth } from '../../hooks/useAuth.js';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const STATUS_TABS = [
  { key: 'All', label: 'All', icon: '📋' },
  { key: 'Pending', label: 'New', icon: '🕐' },
  { key: 'Preparing', label: 'Cooking', icon: '🔥' },
  { key: 'Ready', label: 'Ready', icon: '✅' },
  { key: 'Completed', label: 'Done', icon: '🎉' },
  { key: 'Cancelled', label: 'Cancelled', icon: '❌' },
];

const STATUS_TONES = {
  Pending: 'tone-gold',
  Preparing: 'tone-red',
  Ready: 'tone-green',
  Completed: 'tone-blue',
  Cancelled: 'tone-gray',
};

// Allowed transitions — mirrors the API rules.
const NEXT_ACTIONS = {
  Pending: [
    { to: 'Preparing', label: '🔥 Start cooking', primary: true },
    { to: 'Cancelled', label: 'Cancel' },
  ],
  Preparing: [
    { to: 'Ready', label: '✅ Mark ready', primary: true },
    { to: 'Cancelled', label: 'Cancel' },
  ],
  Ready: [
    { to: 'Completed', label: '🎉 Complete order', primary: true },
  ],
};

export default function AdminOrdersPage() {
  const { user } = useAuth();

  const isAdmin = Boolean(
    user?.roles?.includes('Admin'),
  );

  const [statusFilter, setStatusFilter] = useState('All');
  const [view, setView] = useState({
    status: 'loading',
    orders: [],
    error: '',
  });

  const [busyOrderId, setBusyOrderId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    authRequest('/orders', {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setView({
          status: 'ready',
          orders: Array.isArray(data) ? data : [],
          error: '',
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setView({
          status: 'error',
          orders: [],
          error:
            error.message ||
            'Unable to load the orders.',
        });
      });

    return () => controller.abort();
  }, [requestKey]);

  async function updateStatus(order, nextStatus) {
    if (busyOrderId) return;

    setActionError('');
    setBusyOrderId(order.id);

    try {
      await authRequest(`/orders/${order.id}/status`, {
        method: 'PUT',
        body: { status: nextStatus },
      });

      // Update the card in place without a full reload.
      setView((current) => ({
        ...current,
        orders: current.orders.map((currentOrder) =>
          currentOrder.id === order.id
            ? { ...currentOrder, status: nextStatus }
            : currentOrder,
        ),
      }));
    } catch (error) {
      setActionError(
        error.message ||
          'Unable to update the order status.',
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  function retry() {
    setView({
      status: 'loading',
      orders: [],
      error: '',
    });
    setRequestKey((value) => value + 1);
  }

  const visibleOrders =
    statusFilter === 'All'
      ? view.orders
      : view.orders.filter(
          (order) => order.status === statusFilter,
        );

  const counts = view.orders.reduce(
    (accumulator, order) => {
      accumulator[order.status] =
        (accumulator[order.status] ?? 0) + 1;
      return accumulator;
    },
    {},
  );

  return (
    <section>
      <header className="admin-page-head admin-head-row">
        <div>
          <h1>Orders.</h1>
          <p>Every ticket, from the kitchen to the door.</p>
        </div>

        <button
          type="button"
          className="admin-refresh"
          onClick={retry}
          disabled={view.status === 'loading'}
        >
          ↻ Refresh
        </button>
      </header>

      <div
        className="admin-filter-tabs"
        role="tablist"
        aria-label="Filter orders by status"
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab.key}
            className={
              statusFilter === tab.key
                ? 'admin-tab active'
                : 'admin-tab'
            }
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.icon} {tab.label}

            <span className="admin-tab-count">
              {tab.key === 'All'
                ? view.orders.length
                : (counts[tab.key] ?? 0)}
            </span>
          </button>
        ))}
      </div>

      {actionError && (
        <p className="error-message" role="alert">
          {actionError}
        </p>
      )}

      {view.status === 'loading' && (
        <div className="menu-state" role="status">
          <span className="loading-ring" aria-hidden="true" />
          <p>Loading the tickets...</p>
        </div>
      )}

      {view.status === 'error' && (
        <div className="menu-state">
          <p role="alert">{view.error}</p>
          <button
            type="button"
            className="site-button button-green"
            onClick={retry}
          >
            Try again
          </button>
        </div>
      )}

      {view.status === 'ready' &&
        (visibleOrders.length === 0 ? (
          <div className="menu-state">
            <h2>No orders here.</h2>
            <p>New tickets will appear automatically.</p>
          </div>
        ) : (
          <div className="admin-orders-list">
            {visibleOrders.map((order) => {
              const actions =
                NEXT_ACTIONS[order.status] ?? [];

              return (
                <article
                  key={order.id}
                  className={`admin-order-card ${STATUS_TONES[order.status] ?? ''}`}
                >
                  <header className="admin-order-head">
                    <div>
                      <span className="admin-order-id">
                        #{order.id}
                      </span>

                      <span
                        className={`status-pill ${STATUS_TONES[order.status] ?? ''}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <span className="admin-order-time">
                      {dateTimeFormatter.format(
                        new Date(order.createdAtUtc),
                      )}
                    </span>
                  </header>

                  <div className="admin-order-customer">
                    <strong>{order.customerName}</strong>

                    <span>📞 {order.customerPhone}</span>

                    <span>
                      {order.type === 'Delivery'
                        ? `🛵 ${order.deliveryAddress ?? ''}`
                        : '🏃 Pickup'}
                    </span>
                  </div>

                  <ul className="admin-order-items">
                    {order.items.map((item, index) => (
                      <li
                        key={`${item.menuItemId}-${index}`}
                      >
                        <span>
                          <strong>{item.quantity}×</strong>{' '}
                          {item.name}
                        </span>

                        {item.note && (
                          <em className="admin-item-note">
                            ↳ {item.note}
                          </em>
                        )}
                      </li>
                    ))}
                  </ul>

                  {order.notes && (
                    <p className="admin-order-notes">
                      📝 {order.notes}
                    </p>
                  )}

                  <footer className="admin-order-foot">
                    <span className="admin-order-total">
                      {priceFormatter.format(
                        order.totalAmount,
                      )}
                    </span>

                    <div className="admin-order-actions">
                      {isAdmin &&
                        actions.map((action) => (
                          <button
                            key={action.to}
                            type="button"
                            className={
                              action.primary
                                ? 'admin-action primary'
                                : 'admin-action'
                            }
                            disabled={
                              busyOrderId === order.id
                            }
                            onClick={() =>
                              updateStatus(
                                order,
                                action.to,
                              )
                            }
                          >
                            {action.label}
                          </button>
                        ))}

                      {!isAdmin && actions.length > 0 && (
                        <small className="admin-order-hint">
                          Admin can change status.
                        </small>
                      )}
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        ))}
    </section>
  );
}