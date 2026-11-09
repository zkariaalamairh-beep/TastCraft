import { useEffect, useState } from 'react';

// Customization choices shown for every menu item.
// Selections are compiled into a short note per order line,
// which the kitchen reads on the order ticket.
const ITEM_OPTION_GROUPS = [
  {
    id: 'sauce',
    label: 'Sauce',
    type: 'single',
    options: [
      { label: 'Regular sauce', icon: '🥫' },
      { label: 'No sauce', icon: '🚫' },
      { label: 'Sauce on the side', icon: '🥣' },
      { label: 'Extra sauce', icon: '✨' },
    ],
  },
  {
    id: 'adjustments',
    label: 'Adjustments',
    type: 'multi',
    options: [
      { label: 'No onions', icon: '🧅' },
      { label: 'No pickles', icon: '🥒' },
      { label: 'Make it spicy', icon: '🌶️' },
      { label: 'Extra cheese', icon: '🧀' },
    ],
  },
];

const MAX_NOTE_LENGTH = 200;

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ItemCustomizeModal({
  item,
  initialLine = null,
  onClose,
  onConfirm,
}) {
  const [selections, setSelections] = useState(
    () => initialLine?.selections ?? {},
  );

  const [note, setNote] = useState(initialLine?.note ?? '');

  const [quantity, setQuantity] = useState(
    () => initialLine?.quantity ?? 1,
  );

  // Close on Escape and lock page scroll while open.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.classList.add('modal-open');

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [onClose]);

  function isOptionSelected(groupId, optionLabel) {
    const value = selections[groupId];

    return Array.isArray(value)
      ? value.includes(optionLabel)
      : value === optionLabel;
  }

  function toggleOption(group, optionLabel) {
    setSelections((current) => {
      const next = { ...current };

      if (group.type === 'single') {
        next[group.id] =
          next[group.id] === optionLabel
            ? undefined
            : optionLabel;
      } else {
        const list = Array.isArray(current[group.id])
          ? current[group.id]
          : [];

        next[group.id] = list.includes(optionLabel)
          ? list.filter((value) => value !== optionLabel)
          : [...list, optionLabel];
      }

      return next;
    });
  }

  function handleConfirm() {
    // Drop empty selections before saving.
    const cleanedSelections = Object.fromEntries(
      Object.entries(selections).filter(([, value]) =>
        Array.isArray(value)
          ? value.length > 0
          : Boolean(value),
      ),
    );

    onConfirm({
      quantity,
      selections: cleanedSelections,
      note: note.trim(),
    });
  }

  const lineTotal = item.price * quantity;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-heading">
            <p className="menu-category">
              {item.categoryName}
            </p>

            <h2 id="customize-title">{item.name}</h2>

            <p className="modal-price-hint">
              {priceFormatter.format(item.price)} each
            </p>
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
          {ITEM_OPTION_GROUPS.map((group) => (
            <fieldset key={group.id} className="option-group">
              <legend>
                {group.label}

                <small>
                  {group.type === 'single'
                    ? 'Choose one'
                    : 'Choose any'}
                </small>
              </legend>

              <div className="chip-row">
                {group.options.map((option) => (
                  <label
                    key={option.label}
                    className="option-chip"
                  >
                    <input
                      type={
                        group.type === 'single'
                          ? 'radio'
                          : 'checkbox'
                      }
                      name={`${item.id}-${group.id}`}
                      checked={isOptionSelected(
                        group.id,
                        option.label,
                      )}
                      onChange={() =>
                        toggleOption(group, option.label)
                      }
                    />

                    <span>
                      <span
                        className="chip-emoji"
                        aria-hidden="true"
                      >
                        {option.icon}
                      </span>

                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <div className="form-field modal-note">
            <label htmlFor="item-note">
              Anything else? <small>(optional)</small>
            </label>

            <textarea
              id="item-note"
              rows={2}
              maxLength={MAX_NOTE_LENGTH}
              placeholder="e.g. extra napkins, ring the doorbell..."
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
            />
          </div>
        </div>

        <footer className="modal-footer">
          <div className="qty-stepper">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() =>
                setQuantity((value) => Math.max(1, value - 1))
              }
            >
              −
            </button>

            <span aria-live="polite">{quantity}</span>

            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() =>
                setQuantity((value) => Math.min(99, value + 1))
              }
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="primary-button modal-confirm"
            onClick={handleConfirm}
          >
            {initialLine ? 'Update item' : 'Add to cart'} ·{' '}
            {priceFormatter.format(lineTotal)}
          </button>
        </footer>
      </div>
    </div>
  );
}