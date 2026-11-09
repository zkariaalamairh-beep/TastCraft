import { useEffect, useState } from 'react';

import { apiRequest } from '../../services/api.js';
import { authRequest } from '../../services/auth.js';
import { useAuth } from '../../hooks/useAuth.js';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function CategoryModal({ initial, onClose, onSubmit }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [imageUrl, setImageUrl] = useState(
    initial?.imageUrl ?? '',
  );
  const [displayOrder, setDisplayOrder] = useState(
    initial?.displayOrder ?? 0,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy) return;

    if (name.trim().length < 2) {
      setError('Enter a category name (2+ characters).');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await onSubmit({
        name: name.trim(),
        imageUrl: imageUrl.trim() || null,
        displayOrder: Number(displayOrder) || 0,
      });
    } catch (submitError) {
      setError(
        submitError.message ||
          'Unable to save the category.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-heading">
            <h2>
              {initial ? 'Edit category.' : 'New category.'}
            </h2>
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

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="cat-name">Name</label>

            <input
              id="cat-name"
              type="text"
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="cat-image">
              Image URL <small>(optional)</small>
            </label>

            <input
              id="cat-image"
              type="url"
              maxLength={2048}
              placeholder="https://..."
              value={imageUrl ?? ''}
              onChange={(event) =>
                setImageUrl(event.target.value)
              }
              disabled={busy}
            />
          </div>

          <div className="form-field">
            <label htmlFor="cat-order">Display order</label>

            <input
              id="cat-order"
              type="number"
              min={0}
              max={10000}
              value={displayOrder}
              onChange={(event) =>
                setDisplayOrder(event.target.value)
              }
              disabled={busy}
            />
          </div>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="primary-button modal-confirm"
            disabled={busy}
          >
            {busy ? 'Saving...' : 'Save category'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ItemModal({ initial, categories, onClose, onSubmit }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(
    initial?.description ?? '',
  );
  const [price, setPrice] = useState(initial?.price ?? '');
  const [imageUrl, setImageUrl] = useState(
    initial?.imageUrl ?? '',
  );
  const [isFeatured, setIsFeatured] = useState(
    initial?.isFeatured ?? false,
  );
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories[0]?.id ?? '',
  );

  // Upload from the device.
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(
    initial?.imageUrl ?? '',
  );

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Upload a file from the device and use its URL.
  async function handleUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

           const data = await authRequest(
        '/menu-items/upload-image',
        {
          method: 'POST',
          body: formData,   // بيمرّ كـ multipart مع الـ Bearer تلقائياً
        },
      );

      setImageUrl(data.url);
      setPreview(data.url);
    } catch (uploadError) {
      setError(
        uploadError.message ||
          'Unable to upload the image.',
      );
    } finally {
      setUploading(false);
      // Allow picking the same file again later.
      event.target.value = '';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy || uploading) return;

    const numericPrice = Number(price);

    if (name.trim().length < 2) {
      setError('Enter a dish name (2+ characters).');
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('Enter a valid price.');
      return;
    }

    if (!categoryId) {
      setError('Pick a category.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        price: numericPrice,
        imageUrl: imageUrl.trim() || null,
        isFeatured,
        categoryId: Number(categoryId),
      });
    } catch (submitError) {
      setError(
        submitError.message || 'Unable to save the dish.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-heading">
            <h2>
              {initial ? 'Edit dish.' : 'New dish.'}
            </h2>
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

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="item-name">Name</label>

            <input
              id="item-name"
              type="text"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="item-desc">Description</label>

            <textarea
              id="item-desc"
              rows={3}
              maxLength={1500}
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              disabled={busy}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="item-price">Price (USD)</label>

            <input
              id="item-price"
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={busy}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="item-image">
              Image <small>(upload or paste a URL)</small>
            </label>

            <div className="image-upload-row">
              <input
                id="item-image"
                type="url"
                maxLength={2048}
                placeholder="https://..."
                value={imageUrl ?? ''}
                onChange={(event) => {
                  setImageUrl(event.target.value);
                  setPreview(event.target.value);
                }}
                disabled={busy}
              />

              <label className="image-upload-button">
                {uploading ? 'Uploading...' : '📤 Upload'}

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  disabled={uploading || busy}
                  onChange={handleUpload}
                  hidden
                />
              </label>
            </div>

            {preview && (
              <img
                src={preview}
                alt="Preview"
                className="image-upload-preview"
                onError={(event) => {
                  event.currentTarget.style.display =
                    'none';
                }}
              />
            )}
          </div>

          <div className="form-field">
            <label htmlFor="item-cat">Category</label>

            <select
              id="item-cat"
              value={categoryId}
              onChange={(event) =>
                setCategoryId(event.target.value)
              }
              disabled={busy}
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <label className="option-row admin-feature-row">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(event) =>
                setIsFeatured(event.target.checked)
              }
              disabled={busy}
            />

            <span>⭐ Featured on the menu</span>
          </label>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="primary-button modal-confirm"
            disabled={busy || uploading}
          >
            {busy ? 'Saving...' : 'Save dish'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminMenuPage() {
  const { user } = useAuth();

  const isOwner = Boolean(user?.roles?.includes('Owner'));

  const [categories, setCategories] = useState({
    status: 'loading',
    items: [],
    error: '',
  });

  const [items, setItems] = useState({
    status: 'loading',
    list: [],
    error: '',
  });

  const [editingCategory, setEditingCategory] = useState(null);
  const [creatingCategory, setCreatingCategory] = useState(
    false,
  );

  const [editingItem, setEditingItem] = useState(null);
  const [creatingItem, setCreatingItem] = useState(false);

  const [actionError, setActionError] = useState('');
  const [requestKey, setRequestKey] = useState(0);

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
  }, [requestKey]);

  useEffect(() => {
    const controller = new AbortController();

    apiRequest('/menu-items?pageSize=100', {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setItems({
          status: 'ready',
          list: Array.isArray(data?.items) ? data.items : [],
          error: '',
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setItems({
          status: 'error',
          list: [],
          error: error.message || '',
        });
      });

    return () => controller.abort();
  }, [requestKey]);

  function refresh() {
    setRequestKey((value) => value + 1);
  }

  async function saveCategory(payload) {
    if (editingCategory) {
      await authRequest(
        `/categories/${editingCategory.id}`,
        { method: 'PUT', body: payload },
      );
    } else {
      await authRequest('/categories', {
        method: 'POST',
        body: payload,
      });
    }

    setEditingCategory(null);
    setCreatingCategory(false);
    refresh();
  }

  async function saveItem(payload) {
    if (editingItem) {
      await authRequest(`/menu-items/${editingItem.id}`, {
        method: 'PUT',
        body: payload,
      });
    } else {
      await authRequest('/menu-items', {
        method: 'POST',
        body: payload,
      });
    }

    setEditingItem(null);
    setCreatingItem(false);
    refresh();
  }

  async function toggleAvailability(item) {
    setActionError('');

    try {
      await authRequest(
        `/menu-items/${item.id}/availability`,
        {
          method: 'PATCH',
          body: { isAvailable: !item.isAvailable },
        },
      );

      refresh();
    } catch (error) {
      setActionError(error.message || 'Unable to update.');
    }
  }

  async function deleteCategory(category) {
    if (
      !window.confirm(
        `Delete "${category.name}"? Only empty categories can be deleted.`,
      )
    ) {
      return;
    }

    setActionError('');

    try {
      await authRequest(`/categories/${category.id}`, {
        method: 'DELETE',
      });

      refresh();
    } catch (error) {
      setActionError(
        error.message ||
          'Unable to delete the category.',
      );
    }
  }

  async function deleteItem(item) {
    if (
      !window.confirm(
        `Delete "${item.name}"? Items linked to orders cannot be deleted — disable them instead.`,
      )
    ) {
      return;
    }

    setActionError('');

    try {
      await authRequest(`/menu-items/${item.id}`, {
        method: 'DELETE',
      });

      refresh();
    } catch (error) {
      setActionError(
        error.message ||
          'This dish is linked to orders. Disable it instead.',
      );
    }
  }

  return (
    <section>
      <header className="admin-page-head admin-head-row">
        <div>
          <h1>Menu management.</h1>
          <p>
            Categories and dishes, exactly as guests see
            them.
          </p>
        </div>

        <div className="admin-head-actions">
          <button
            type="button"
            className="admin-refresh"
            onClick={() => setCreatingCategory(true)}
          >
            + Category
          </button>

          <button
            type="button"
            className="admin-action primary"
            onClick={() => setCreatingItem(true)}
            disabled={categories.items.length === 0}
          >
            + New dish
          </button>
        </div>
      </header>

      {actionError && (
        <p className="error-message" role="alert">
          {actionError}
        </p>
      )}

      {categories.status === 'error' && (
        <div className="menu-state">
          <p role="alert">{categories.error}</p>
        </div>
      )}

      {items.status === 'loading' ||
      categories.status === 'loading' ? (
        <div className="menu-state" role="status">
          <span
            className="loading-ring"
            aria-hidden="true"
          />
          <p>Loading the kitchen shelves...</p>
        </div>
      ) : (
        <>
          <div className="admin-cat-row">
            {categories.items.map((category) => (
              <div
                key={category.id}
                className="admin-cat-chip"
              >
                <span>{category.name}</span>

                <button
                  type="button"
                  aria-label={`Edit ${category.name}`}
                  onClick={() =>
                    setEditingCategory(category)
                  }
                >
                  ✏️
                </button>

                {isOwner && (
                  <button
                    type="button"
                    aria-label={`Delete ${category.name}`}
                    onClick={() =>
                      deleteCategory(category)
                    }
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}

            {categories.items.length === 0 && (
              <p className="muted">
                No categories yet — create one to start.
              </p>
            )}
          </div>

          <div className="admin-menu-grid">
            {items.list.map((item) => (
              <article
                key={item.id}
                className="admin-menu-card"
              >
                <div className="admin-menu-media">
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

                <div className="admin-menu-body">
                  <div className="admin-menu-title-row">
                    <h3>{item.name}</h3>

                    <span
                      className={`status-pill ${
                        item.isAvailable
                          ? 'tone-green'
                          : 'tone-gray'
                      }`}
                    >
                      {item.isAvailable
                        ? 'Available'
                        : 'Off menu'}
                    </span>
                  </div>

                  <p className="admin-menu-cat">
                    {item.categoryName}

                    {item.isFeatured && ' · ⭐ Featured'}
                  </p>

                  <p className="admin-menu-price">
                    {priceFormatter.format(item.price)}
                  </p>

                  <div className="admin-menu-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setEditingItem(item)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className={
                        item.isAvailable
                          ? 'text-button danger'
                          : 'text-button'
                      }
                      onClick={() =>
                        toggleAvailability(item)
                      }
                    >
                      {item.isAvailable
                        ? 'Disable'
                        : 'Enable'}
                    </button>

                    {isOwner && (
                      <button
                        type="button"
                        className="text-button danger"
                        onClick={() => deleteItem(item)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}

            {items.list.length === 0 && (
              <div className="menu-state">
                <h2>No dishes yet.</h2>
                <p>
                  Add your first dish to open the
                  kitchen.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {(creatingCategory || editingCategory) && (
        <CategoryModal
          initial={editingCategory}
          onClose={() => {
            setCreatingCategory(false);
            setEditingCategory(null);
          }}
          onSubmit={saveCategory}
        />
      )}

      {(creatingItem || editingItem) && (
        <ItemModal
          initial={editingItem}
          categories={categories.items}
          onClose={() => {
            setCreatingItem(false);
            setEditingItem(null);
          }}
          onSubmit={saveItem}
        />
      )}
    </section>
  );
}