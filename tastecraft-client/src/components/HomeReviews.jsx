import { useEffect, useState } from 'react';

import { apiRequest } from '../services/api.js';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

// Latest guest reviews for the home page.
// Hides itself when there is nothing to show yet.
export default function HomeReviews() {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    apiRequest('/reviews/home', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setReviews(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // The section simply stays hidden on failure.
      });

    return () => controller.abort();
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section
      id="guest-reviews"
      className="home-reviews site-container"
    >
      <header className="section-heading">
        <p className="eyebrow">WHAT GUESTS SAY</p>

        <h2>Moments our guests remember.</h2>
      </header>

      <div className="home-reviews-grid">
        {reviews.map((review, index) => (
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

            <blockquote>“{review.comment}”</blockquote>

            <time>
              {dateFormatter.format(
                new Date(review.createdAtUtc),
              )}
            </time>
          </article>
        ))}
      </div>
    </section>
  );
}