import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../services/api.js';
import { useCart } from '../context/CartContext.jsx';
import ItemCustomizeModal from '../components/ItemCustomizeModal.jsx';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PAGE_SIZE = 12;

function MenuCard({ item, line, onCustomize }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className="menu-card">
      <div className="menu-card-media">
        {item.imageUrl && !imageFailed ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="menu-photo-placeholder">
            <span aria-hidden="true">TC</span>
            <small>Photo coming soon</small>
          </div>
        )}

        {!item.isAvailable ? (
          <span className="menu-badge unavailable">
            Currently unavailable
          </span>
        ) : item.isFeatured ? (
          <span className="menu-badge">
            A Taste Craft favourite
          </span>
        ) : null}
      </div>

      <div className="menu-card-body">
        <p className="menu-category">{item.categoryName}</p>

        <h2>{item.name}</h2>

        <p className="menu-description">{item.description}</p>

        <div className="menu-card-footer">
          <p className="menu-price">
            {priceFormatter.format(item.price)}
          </p>

          <button
            type="button"
            className="menu-add-button"
            disabled={!item.isAvailable}
            onClick={() => onCustomize(item)}
          >
            {line
              ? `In cart · ${line.quantity}`
              : 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function MenuPage() {
  const { lines, upsertLine } = useCart();

  const [categories, setCategories] = useState({
    status: 'loading',
    items: [],
    error: '',
  });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(null);

  const [page, setPage] = useState(1);
  const [requestKey, setRequestKey] = useState(0);

  const [customizing, setCustomizing] = useState(null);

  const [view, setView] = useState({
    status: 'loading',
    items: [],
    totalItems: 0,
    totalPages: 0,
    error: '',
  });

  // Debounce: wait a moment before searching.
  useEffect(() => {
    const timer = setTimeout(
      () => setSearch(searchInput.trim()),
      400,
    );

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Any filter change returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, categoryId]);

  // Categories load once.
  useEffect(() => {
    const controller = new AbortController();

    apiRequest('/categories', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;

        setCategories({
          status: 'ready',
          items: Array.isArray(data) ? data : [],
          error: '',
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        setCategories({
          status: 'error',
          items: [],
          error: error.message || '',
        });
      });

    return () => controller.abort();
  }, []);

  // Menu items with filters and pagination.
  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    if (search) params.set('search', search);
    if (categoryId != null) {
      params.set('categoryId', String(categoryId));
    }

    setView((current) => ({
      ...current,
      status: 'loading',
      error: '',
    }));

    apiRequest(`/menu-items?${params}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!Array.isArray(data?.items)) {
          throw new Error(
            'The API returned an invalid menu response.',
          );
        }

        if (controller.signal.aborted) return;

        setView({
          status: 'ready',
          items: data.items,
          totalItems: data.totalItems,
          totalPages: data.totalPages,
          error: '',
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        setView((current) => ({
          ...current,
          status: 'error',
          error:
            error.message || 'Unable to load the menu.',
        }));
      });

    return () => controller.abort();
  }, [page, search, categoryId, requestKey]);

  function retry() {
    setView((current) => ({
      ...current,
      status: 'loading',
      error: '',
    }));
    setRequestKey((value) => value + 1);
  }

  const hasActiveFilters =
    Boolean(search) || categoryId != null;

  return (
    <main className="menu-page site-container">
      <header className="section-heading menu-heading">
        <p className="eyebrow">FIND YOUR NEXT FAVOURITE</p>

        <h1>Our menu.</h1>

        <p>
          A little comfort. A little indulgence. Something
          for your next good moment.
        </p>
      </header>

      <div className="menu-toolbar">
        <div className="menu-search">
          <label
            className="visually-hidden"
            htmlFor="menu-search"
          >
            Search the menu
          </label>

          <input
            id="menu-search"
            type="search"
            placeholder="Search dishes..."
            maxLength={120}
            value={searchInput}
            onChange={(event) =>
              setSearchInput(event.target.value)
            }
          />
        </div>

        {categories.status === 'ready' &&
          categories.items.length > 0 && (
            <div
              className="menu-filters"
              aria-label="Filter by category"
            >
              <button
                type="button"
                className={
                  categoryId == null
                    ? 'menu-chip active'
                    : 'menu-chip'
                }
                onClick={() => setCategoryId(null)}
              >
                All
              </button>

              {categories.items.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={
                    categoryId === category.id
                      ? 'menu-chip active'
                      : 'menu-chip'
                  }
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
      </div>

      {view.status === 'loading' && (
        <div className="menu-state" role="status">
          <span className="loading-ring" aria-hidden="true" />
          <p>Preparing the menu...</p>
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

      {view.status === 'ready' && (
        <>
          {view.items.length === 0 ? (
            <div className="menu-state">
              <h2>
                {hasActiveFilters
                  ? 'No dishes match your search.'
                  : 'No dishes to show yet.'}
              </h2>

              <p>
                {hasActiveFilters
                  ? 'Try a different word or category.'
                  : 'Please check back soon.'}
              </p>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="site-button button-green"
                  onClick={() => {
                    setSearchInput('');
                    setCategoryId(null);
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="menu-results">
                {view.totalItems}{' '}
                {view.totalItems === 1
                  ? 'dish'
                  : 'dishes'}{' '}
                on the menu
              </p>

              <div className="menu-grid">
                {view.items.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    line={lines.find(
                      (line) => line.menuItemId === item.id,
                    )}
                    onCustomize={(menuItem) =>
                      setCustomizing({
                        item: menuItem,
                        line: lines.find(
                          (line) =>
                            line.menuItemId === menuItem.id,
                        ),
                      })
                    }
                  />
                ))}
              </div>
            </>
          )}

          {(view.totalPages > 1 || page > 1) && (
            <nav
              className="menu-pagination"
              aria-label="Menu pagination"
            >
              <button
                type="button"
                className="site-button button-green"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>

              <span>Page {page}</span>

              <button
                type="button"
                className="site-button button-green"
                disabled={page >= view.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}

      {customizing && (
        <ItemCustomizeModal
          item={customizing.item}
          initialLine={customizing.line}
          onClose={() => setCustomizing(null)}
          onConfirm={(payload) => {
            upsertLine(customizing.item, payload);
            setCustomizing(null);
          }}
        />
      )}
    </main>
  );
}