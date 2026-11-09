import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getMyOrders } from '../services/orders.js';
import { useAuth } from '../hooks/useAuth.js';
import ReviewModal from '../components/ReviewModal.jsx';

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

const STATUS_STEPS = [
  { key: 'Pending', label: 'Received', icon: '🕐' },
  { key: 'Preparing', label: 'Cooking', icon: '🔥' },
  { key: 'Ready', label: 'Ready', icon: '✅' },
  { key: 'Completed', label: 'Enjoyed', icon: '🎉' },
];

function StatusStepper({ status }) {
  const activeIndex = STATUS_STEPS.findIndex(
    (step) => step.key === status,
  );

  return (
    <ol
      className="status-stepper"
      aria-label="Order progress"
    >
      {STATUS_STEPS.map((step, index) => {
        const state =
          index < activeIndex
            ? 'done'
            : index === activeIndex
              ? 'active'
              : 'upcoming';

        return (
          <li key={step.key} className={`step ${state}`}>
            <span
              className="step-icon"
              aria-hidden="true"
            >
              {step.icon}
            </span>

            <span className="step-label">
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderCard({
  order,
  expanded,
  onToggle,
  onRate,
  isRated,
}) {
  const visibleItems = expanded
    ? order.items
    : order.items.slice(0, 2);

  const hiddenCount =
    order.items.length - visibleItems.length;

  return (
    <article className="order-card">
      <header className="order-card-head">
        <div>
          <h2>Order #{order.id}</h2>

          <p className="order-meta">
            {dateTimeFormatter.format(
              new Date(order.createdAtUtc),
            )}{' '}
            ·{' '}
            {order.type === 'Delivery'
              ? '🛵 Delivery'
              : '🏃 Pickup'}
          </p>
        </div>

        <p className="order-total">
          {priceFormatter.format(order.totalAmount)}
        </p>
      </header>

      {order.status === 'Cancelled' ? (
        <p className="order-cancelled" role="status">
          ❌ This order was cancelled.
        </p>
      ) : (
        <StatusStepper status={order.status} />
      )}

      <ul className="order-items">
        {visibleItems.map((item, index) => (
          <li key={`${item.menuItemId}-${index}`}>
            <span className="order-item-name">
              <strong>{item.quantity}×</strong>{' '}
              {item.name}
            </span>

            <span className="order-item-price">
              {priceFormatter.format(item.lineTotal)}
            </span>

            {item.note && (
              <p className="order-item-note">
                ↳ {item.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <p className="order-more">
          + {hiddenCount} more{' '}
          {hiddenCount === 1 ? 'item' : 'items'}
        </p>
      )}

      {expanded && (
        <dl className="order-details">
          {order.deliveryAddress && (
            <div>
              <dt>Delivery address</dt>
              <dd>{order.deliveryAddress}</dd>
            </div>
          )}

          {order.notes && (
            <div>
              <dt>Order notes</dt>
              <dd>{order.notes}</dd>
            </div>
          )}

          <div>
            <dt>Subtotal</dt>
            <dd>
              {priceFormatter.format(order.subtotal)}
            </dd>
          </div>

          <div>
            <dt>Delivery fee</dt>
            <dd>
              {order.deliveryFee === 0
                ? 'Free'
                : priceFormatter.format(
                    order.deliveryFee,
                  )}
            </dd>
          </div>
        </dl>
      )}

      <footer className="order-card-actions">
        <button
          type="button"
          className="text-button"
          onClick={onToggle}
        >
          {expanded ? 'Show less' : 'View details'}
        </button>

        {order.status === 'Completed' && (
          <button
            type="button"
            className={
              isRated
                ? 'rate-button rated'
                : 'rate-button'
            }
            onClick={onRate}
          >
            {isRated
              ? '⭐ Your rating'
              : '⭐ Rate this order'}
          </button>
        )}
      </footer>
    </article>
  );
}

export default function MyOrdersPage() {
  const { isAuthenticated, status: authStatus } =
    useAuth();

  const [view, setView] = useState({
    status: 'loading',
    orders: [],
    error: '',
  });

  const [expandedId, setExpandedId] = useState(null);
  const [reviewingOrder, setReviewingOrder] =
    useState(null);
  const [ratedOrderIds, setRatedOrderIds] = useState(
    () => new Set(),
  );
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    if (authStatus === 'loading') return;

    if (!isAuthenticated) {
      setView({ status: 'ready', orders: [], error: '' });
      return;
    }

    const controller = new AbortController();

    setView((current) => ({
      ...current,
      status: 'loading',
      error: '',
    }));

    getMyOrders()
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

        setView((current) => ({
          ...current,
          status: 'error',
          error:
            error.message ||
            'Unable to load your orders.',
        }));
      });

    return () => controller.abort();
  }, [isAuthenticated, authStatus, requestKey]);

  function handleReviewSubmitted(orderId) {
    setRatedOrderIds((current) => {
      const next = new Set(current);
      next.add(orderId);
      return next;
    });

    setReviewingOrder(null);
  }

  let content;

  if (authStatus === 'loading' || view.status === 'loading') {
    content = (
      <div className="menu-state" role="status">
        <span className="loading-ring" aria-hidden="true" />
        <p>Gathering your orders...</p>
      </div>
    );
  } else if (!isAuthenticated) {
    content = (
      <div className="menu-state">
        <h2>Sign in to see your orders.</h2>

        <p>
          Your order history and tracking live with
          your account.
        </p>

        <Link
          className="site-button button-green"
          to="/signin"
        >
          Sign in
        </Link>
      </div>
    );
  } else if (view.status === 'error') {
    content = (
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
  } else if (view.orders.length === 0) {
    content = (
      <div className="menu-state">
        <h2>No orders yet.</h2>

        <p>
          Your next favourite meal is one tap away.
        </p>

        <Link
          className="site-button button-green"
          to="/menu"
        >
          Explore the menu
        </Link>
      </div>
    );
  } else {
    content = (
      <div className="orders-list">
        {view.orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            expanded={expandedId === order.id}
            onToggle={() =>
              setExpandedId((current) =>
                current === order.id ? null : order.id,
              )
            }
            onRate={() => setReviewingOrder(order)}
            isRated={ratedOrderIds.has(order.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <main className="orders-page site-container">
      <header className="section-heading">
        <p className="eyebrow">YOUR HISTORY</p>

        <h1>My orders.</h1>

        <p>
          Track every meal from the kitchen to your
          table.
        </p>
      </header>

      {content}

      {reviewingOrder && (
        <ReviewModal
          order={reviewingOrder}
          onClose={() => setReviewingOrder(null)}
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </main>
  );
}