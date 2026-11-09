import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiRequest } from '../services/api.js';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Shows the kitchen's featured dishes on the home page.
// Quietly disappears when nothing is featured or offline.
export default function HomeFeatured() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    apiRequest(
      '/menu-items?isFeatured=true&isAvailable=true&pageSize=3',
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        // The section simply stays hidden on failure.
      });

    return () => controller.abort();
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="home-featured site-container">
      <header className="section-heading">
        <p className="eyebrow">CHEF&apos;S FAVOURITES</p>

        <h2>The dishes people come back for.</h2>
      </header>

      <div className="home-featured-grid">
        {items.map((item) => (
          <Link
            key={item.id}
            to="/menu"
            className="home-featured-card"
          >
            <div className="home-featured-media">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  loading="lazy"
                />
              ) : (
                <span className="cart-line-placeholder">
                  TC
                </span>
              )}
            </div>

            <div className="home-featured-body">
              <p className="menu-category">
                {item.categoryName}
              </p>

              <h3>{item.name}</h3>

              <div className="home-featured-foot">
                <span className="home-featured-price">
                  {priceFormatter.format(item.price)}
                </span>

                <span className="home-featured-cta">
                  Order it →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="home-featured-more">
        <Link className="site-button button-green" to="/menu">
          Explore the full menu
        </Link>
      </div>
    </section>
  );
}