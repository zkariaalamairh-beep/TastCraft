import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiRequest } from '../services/api.js';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
});

export default function ReviewsPage() {
  const [view, setView] = useState({
    status: 'loading',
    reviews: [],
  });

  useEffect(() => {
    const controller = new AbortController();

    apiRequest('/reviews/home?count=24', {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setView({
          status: 'ready',
          reviews: Array.isArray(data) ? data : [],
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setView({ status: 'ready', reviews: [] });
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="reviews-page site-container">
      <header className="section-heading">
        <p className="eyebrow">WHAT GUESTS SAY</p>

        <h1>Guest reviews.</h1>

        <p>
          Every rating below comes from a real completed
          order.
        </p>
      </header>

      {view.status === 'loading' && (
        <div className="menu-state" role="status">
          <span className="loading-ring" aria-hidden="true" />
          <p>Gathering the reviews...</p>
        </div>
      )}

      {view.status === 'ready' && view.reviews.length === 0 && (
        <div className="menu-state">
          <h2>No reviews yet.</h2>

          <p>
            Be the first — complete an order and share your
            experience.
          </p>

          <Link className="site-button button-green" to="/menu">
            Explore the menu
          </Link>
        </div>
      )}

      {view.status === 'ready' && view.reviews.length > 0 && (
        <div className="home-reviews-grid reviews-page-grid">
          {view.reviews.map((review, index) => (
            <article
              key={`${review.createdAtUtc}-${index}`}
              className="home-review-card"
            >
              <div
                className="review-stars"
                aria-label={`${review.rating} out of 5`}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    aria-hidden="true"
                    className={
                      star <= review.rating
                        ? 'star filled'
                        : 'star'
                    }
                  >
                    ★
                  </span>
                ))}
              </div>

              {review.comment ? (
                <blockquote>
                  “{review.comment}”
                </blockquote>
              ) : (
                <p className="review-no-comment">
                  Rated {review.rating}/5 — no written note.
                </p>
              )}

              <time>
                {dateFormatter.format(
                  new Date(review.createdAtUtc),
                )}
              </time>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}