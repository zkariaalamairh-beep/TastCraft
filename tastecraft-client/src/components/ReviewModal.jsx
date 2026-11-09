import { useEffect, useState } from 'react';

import {
  createOrderReview,
  getOrderReview,
} from '../services/orders.js';

const RATING_LABELS = {
  1: 'Not good',
  2: 'Could be better',
  3: 'Okay',
  4: 'Great',
  5: 'Loved it',
};

export default function ReviewModal({
  order,
  onClose,
  onSubmitted,
}) {
  const [loading, setLoading] = useState(true);
  const [existingReview, setExistingReview] = useState(null);

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Check whether this order was already rated.
  useEffect(() => {
    const controller = new AbortController();

    getOrderReview(order.id, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setExistingReview(data ?? null);
        setLoading(false);
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) return;

        // 404 = not rated yet → show the form.
        if (fetchError.status === 404) {
          setExistingReview(null);
          setLoading(false);
          return;
        }

        setError(
          fetchError.message ||
            'Unable to load your review.',
        );
        setLoading(false);
      });

    return () => controller.abort();
  }, [order.id]);

  // Escape closes and page scroll is locked.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.classList.add('modal-open');

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
      document.body.classList.remove('modal-open');
    };
  }, [onClose]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting || rating < 1) return;

    setSubmitting(true);
    setError('');

    try {
      await createOrderReview(order.id, {
        rating,
        comment: comment.trim() || undefined,
      });

      onSubmitted(order.id);
    } catch (submitError) {
      setError(
        submitError.message ||
          'Unable to submit your review.',
      );
      setSubmitting(false);
    }
  }

  const displayRating = hoveredRating || rating;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-heading">
            <p className="menu-category">
              Order #{order.id}
            </p>

            <h2 id="review-title">Rate your meal.</h2>
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

        <div className="modal-body">
          {loading ? (
            <p className="review-loading" role="status">
              Checking your rating...
            </p>
          ) : existingReview ? (
            <div className="review-existing">
              <div
                className="review-stars"
                aria-label={`You rated this order ${existingReview.rating} out of 5`}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    aria-hidden="true"
                    className={
                      star <= existingReview.rating
                        ? 'star filled'
                        : 'star'
                    }
                  >
                    ★
                  </span>
                ))}
              </div>

              <p className="review-existing-note">
                Thank you! You rated this order{' '}
                {existingReview.rating}/5.
              </p>

              {existingReview.comment && (
                <blockquote className="review-comment">
                  “{existingReview.comment}”
                </blockquote>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              aria-busy={submitting}
            >
              <div
                className="star-picker"
                onMouseLeave={() => setHoveredRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={
                      star <= displayRating
                        ? 'star-button filled'
                        : 'star-button'
                    }
                    aria-label={`Rate ${star} out of 5`}
                    onMouseEnter={() =>
                      setHoveredRating(star)
                    }
                    onFocus={() => setHoveredRating(star)}
                    onClick={() => setRating(star)}
                  >
                    ★
                  </button>
                ))}
              </div>

              <p
                className="star-hint"
                aria-live="polite"
              >
                {displayRating
                  ? RATING_LABELS[displayRating]
                  : 'How was everything?'}
              </p>

              <div className="form-field modal-note">
                <label htmlFor="review-comment">
                  Tell us more <small>(optional)</small>
                </label>

                <textarea
                  id="review-comment"
                  rows={3}
                  maxLength={1000}
                  placeholder="What did you love? What can we do better?"
                  value={comment}
                  onChange={(event) =>
                    setComment(event.target.value)
                  }
                  disabled={submitting}
                />
              </div>

              {error && (
                <p
                  className="error-message"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="primary-button modal-confirm"
                disabled={submitting || rating < 1}
              >
                {submitting
                  ? 'Sending...'
                  : 'Submit review'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}