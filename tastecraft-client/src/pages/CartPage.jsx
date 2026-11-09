import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  quoteOrder,
  createOrder,
} from '../services/orders.js';
import { useAuth } from '../hooks/useAuth.js';
import { useCart } from '../context/CartContext.jsx';
import { buildItemNote } from '../data/itemOptions.js';
import ItemCustomizeModal from '../components/ItemCustomizeModal.jsx';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ORDER_TYPES = [
  { value: 'Pickup', label: 'Pickup' },
  { value: 'Delivery', label: 'Delivery' },
];

function CartLine({ line, onEdit, onRemove, onQuantity }) {
  const note = buildItemNote(line);

  return (
    <li className="cart-line">
      <div className="cart-line-media">
        {line.imageUrl ? (
          <img src={line.imageUrl} alt={line.name} />
        ) : (
          <span
            className="cart-line-placeholder"
            aria-hidden="true"
          >
            TC
          </span>
        )}
      </div>

      <div className="cart-line-info">
        <h3>{line.name}</h3>

        <p className="cart-line-unit">
          {priceFormatter.format(line.unitPrice)} each
        </p>

        {note && <p className="cart-line-note">{note}</p>}

        <div className="cart-line-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => onEdit(line)}
          >
            Edit
          </button>

          <button
            type="button"
            className="text-button danger"
            onClick={() => onRemove(line.menuItemId)}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="cart-line-side">
        <div className="qty-stepper">
          <button
            type="button"
            aria-label={`Decrease ${line.name} quantity`}
            onClick={() =>
              onQuantity(line.menuItemId, line.quantity - 1)
            }
          >
            −
          </button>

          <span aria-live="polite">{line.quantity}</span>

          <button
            type="button"
            aria-label={`Increase ${line.name} quantity`}
            onClick={() =>
              onQuantity(line.menuItemId, line.quantity + 1)
            }
          >
            +
          </button>
        </div>

        <p className="cart-line-total">
          {priceFormatter.format(
            line.unitPrice * line.quantity,
          )}
        </p>
      </div>
    </li>
  );
}

export default function CartPage() {
  const { lines, upsertLine, setQuantity, removeLine, clear } =
    useCart();

  const { isAuthenticated, status: authStatus } = useAuth();
  const navigate = useNavigate();

  const [orderType, setOrderType] = useState('Pickup');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [quote, setQuote] = useState({
    status: 'idle',
    data: null,
    error: '',
  });

  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);
  const [editingLine, setEditingLine] = useState(null);

  // Live pricing: recalculate shortly after any cart change.
  useEffect(() => {
    if (lines.length === 0) {
      setQuote({ status: 'idle', data: null, error: '' });
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(() => {
      setQuote((current) => ({
        ...current,
        status: 'loading',
        error: '',
      }));

      quoteOrder(
        {
          type: orderType,
          items: lines.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            note: buildItemNote(line),
          })),
        },
        { signal: controller.signal },
      )
        .then((data) => {
          if (controller.signal.aborted) return;
          setQuote({ status: 'ready', data, error: '' });
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setQuote({
            status: 'error',
            data: null,
            error:
              error.message ||
              'Unable to calculate your total.',
          });
        });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lines, orderType]);

  async function handlePlaceOrder(event) {
    event.preventDefault();

    if (placing || lines.length === 0) return;

    setPlaceError('');

    if (orderType === 'Delivery' && !deliveryAddress.trim()) {
      setPlaceError('A delivery address is required.');
      return;
    }

    setPlacing(true);

    try {
      const order = await createOrder({
        type: orderType,
        phoneNumber: phoneNumber.trim(),
        deliveryAddress:
          orderType === 'Delivery'
            ? deliveryAddress.trim()
            : undefined,
        notes: notes.trim() || undefined,
        items: lines.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          note: buildItemNote(line),
        })),
      });

      clear();
      setPlacedOrder(order);
      window.scrollTo(0, 0);
    } catch (error) {
      setPlaceError(
        error.message || 'Unable to place your order.',
      );
    } finally {
      setPlacing(false);
    }
  }

  if (placedOrder) {
    return (
      <main className="cart-page site-container">
        <div className="cart-success">
          <p className="eyebrow">ORDER CONFIRMED</p>

          <h1>Thank you, {placedOrder.customerName}.</h1>

          <p>
            Your order{' '}
            <strong>#{placedOrder.id}</strong> is now{' '}
            <strong>{placedOrder.status}</strong>. The kitchen
            has received every detail, including your
            customizations.
          </p>

          <p className="cart-success-total">
            Total:{' '}
            <strong>
              {priceFormatter.format(placedOrder.totalAmount)}
            </strong>
          </p>

          <div className="cart-success-actions">
            <Link className="site-button button-green" to="/menu">
              Back to the menu
            </Link>

            <button
              type="button"
              className="text-button"
              onClick={() => navigate('/')}
            >
              Go home
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main className="cart-page site-container">
        <header className="section-heading">
          <p className="eyebrow">YOUR ORDER</p>
          <h1>Your order.</h1>
        </header>

        <div className="menu-state">
          <h2>Your order is empty.</h2>

          <p>
            Find something delicious to look forward to.
          </p>

          <Link className="site-button button-green" to="/menu">
            Explore the menu
          </Link>
        </div>
      </main>
    );
  }

  const quoteData = quote.data;
  const freeDeliveryRemaining =
    orderType === 'Delivery' && quoteData
      ? quoteData.amountUntilFreeDelivery
      : 0;

  const progressPercent =
    orderType === 'Delivery' && quoteData
      ? Math.min(
          100,
          (quoteData.subtotal /
            quoteData.freeDeliveryThreshold) *
            100,
        )
      : 0;

  return (
    <main className="cart-page site-container">
      <header className="section-heading">
        <p className="eyebrow">YOUR ORDER</p>
        <h1>Your order.</h1>
      </header>

      <div className="cart-layout">
        <section aria-label="Your items">
          <ul className="cart-lines">
            {lines.map((line) => (
              <CartLine
                key={line.menuItemId}
                line={line}
                onEdit={setEditingLine}
                onRemove={removeLine}
                onQuantity={setQuantity}
              />
            ))}
          </ul>

          <button
            type="button"
            className="text-button start-over"
            onClick={() => {
              if (
                window.confirm(
                  'Start over? This clears your current order.',
                )
              ) {
                clear();
              }
            }}
          >
            Start over
          </button>
        </section>

        <aside
          className="cart-summary"
          aria-label="Order summary"
        >
          <h2>Order summary</h2>

          <div
            className="order-type-toggle"
            role="radiogroup"
            aria-label="Order type"
          >
            {ORDER_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                role="radio"
                aria-checked={orderType === type.value}
                className={
                  orderType === type.value
                    ? 'order-type active'
                    : 'order-type'
                }
                onClick={() => setOrderType(type.value)}
              >
                {type.label}
              </button>
            ))}
          </div>

          {orderType === 'Delivery' && quoteData && (
            <div className="delivery-progress">
              <div className="delivery-progress-track">
                <div
                  className="delivery-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p>
                {freeDeliveryRemaining > 0
                  ? `Add ${priceFormatter.format(freeDeliveryRemaining)} more for free delivery.`
                  : 'You unlocked free delivery.'}
              </p>
            </div>
          )}

          {quote.status === 'loading' && (
            <p className="cart-quote-state" role="status">
              Updating prices...
            </p>
          )}

          {quote.status === 'error' && (
            <p className="cart-quote-state" role="alert">
              {quote.error}
            </p>
          )}

          {quote.status === 'ready' && quoteData && (
            <dl className="cart-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>
                  {priceFormatter.format(quoteData.subtotal)}
                </dd>
              </div>

              <div>
                <dt>Delivery fee</dt>
                <dd>
                  {quoteData.deliveryFee === 0
                    ? 'Free'
                    : priceFormatter.format(
                        quoteData.deliveryFee,
                      )}
                </dd>
              </div>

              <div className="cart-grand-total">
                <dt>Total</dt>
                <dd>
                  {priceFormatter.format(
                    quoteData.totalAmount,
                  )}
                </dd>
              </div>
            </dl>
          )}

          {isAuthenticated ? (
            <form
              className="checkout-form"
              onSubmit={handlePlaceOrder}
              aria-busy={placing}
            >
              <div className="form-field">
                <label htmlFor="phone">Phone number</label>

                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                  placeholder="e.g. 0599123456"
                  value={phoneNumber}
                  onChange={(event) =>
                    setPhoneNumber(event.target.value)
                  }
                  disabled={placing}
                  required
                />
              </div>

              {orderType === 'Delivery' && (
                <div className="form-field">
                  <label htmlFor="address">
                    Delivery address
                  </label>

                  <input
                    id="address"
                    type="text"
                    autoComplete="street-address"
                    maxLength={500}
                    placeholder="Street, building, floor..."
                    value={deliveryAddress}
                    onChange={(event) =>
                      setDeliveryAddress(event.target.value)
                    }
                    disabled={placing}
                    required
                  />
                </div>
              )}

              <div className="form-field">
                <label htmlFor="order-notes">
                  Order notes (optional)
                </label>

                <textarea
                  id="order-notes"
                  rows={2}
                  maxLength={500}
                  placeholder="Anything the kitchen should know?"
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  disabled={placing}
                />
              </div>

              {placeError && (
                <p className="error-message" role="alert">
                  {placeError}
                </p>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={placing || quote.status !== 'ready'}
              >
                {placing
                  ? 'Placing your order...'
                  : `Place order · ${
                      quoteData
                        ? priceFormatter.format(
                            quoteData.totalAmount,
                          )
                        : ''
                    }`}
              </button>
            </form>
          ) : (
            <div className="checkout-signin">
              {authStatus === 'loading' ? (
                <p>Checking your session...</p>
              ) : (
                <>
                  <p>Sign in to place your order.</p>

                  <Link className="primary-button" to="/signin">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          )}
        </aside>
      </div>

      {editingLine && (
        <ItemCustomizeModal
          item={{
            id: editingLine.menuItemId,
            name: editingLine.name,
            price: editingLine.unitPrice,
            categoryName: 'Your order',
          }}
          initialLine={editingLine}
          onClose={() => setEditingLine(null)}
          onConfirm={(payload) => {
            upsertLine(
              {
                id: editingLine.menuItemId,
                name: editingLine.name,
                price: editingLine.unitPrice,
                isAvailable: true,
              },
              payload,
            );
            setEditingLine(null);
          }}
        />
      )}
    </main>
  );
}