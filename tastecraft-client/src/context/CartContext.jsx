import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const CartContext = createContext(null);

// v2: lines carry customization selections.
const STORAGE_KEY = 'tastecraft-cart-v2';

// Limits enforced by the API as well.
const MAX_LINES = 50;
const MAX_QUANTITY = 99;

function loadInitialLines() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (line) =>
        Number.isInteger(line?.menuItemId) &&
        line.menuItemId > 0 &&
        Number.isInteger(line?.quantity) &&
        line.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [lines, setLines] = useState(loadInitialLines);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo(() => {
    // One line per menu item: adding an existing item
    // updates its quantity and customization instead.
    function upsertLine(
      item,
      { quantity = 1, selections = {}, note = '' } = {},
    ) {
      if (!item?.isAvailable) {
        return { ok: false, reason: 'unavailable' };
      }

      const safeQuantity = Math.min(
        MAX_QUANTITY,
        Math.max(1, quantity),
      );

      setLines((current) => {
        const existing = current.find(
          (line) => line.menuItemId === item.id,
        );

        if (existing) {
          return current.map((line) =>
            line.menuItemId === item.id
              ? {
                  ...line,
                  quantity: safeQuantity,
                  selections,
                  note,
                }
              : line,
          );
        }

        if (current.length >= MAX_LINES) {
          return current;
        }

        return [
          ...current,
          {
            menuItemId: item.id,
            name: item.name,
            unitPrice: item.price,
            imageUrl: item.imageUrl ?? null,
            quantity: safeQuantity,
            selections,
            note,
          },
        ];
      });

      return { ok: true };
    }

    function setQuantity(menuItemId, quantity) {
      if (quantity < 1) {
        removeLine(menuItemId);
        return;
      }

      setLines((current) =>
        current.map((line) =>
          line.menuItemId === menuItemId
            ? {
                ...line,
                quantity: Math.min(MAX_QUANTITY, quantity),
              }
            : line,
        ),
      );
    }

    function removeLine(menuItemId) {
      setLines((current) =>
        current.filter(
          (line) => line.menuItemId !== menuItemId,
        ),
      );
    }

    function clear() {
      setLines([]);
    }

    const count = lines.reduce(
      (sum, line) => sum + line.quantity,
      0,
    );

    return {
      lines,
      count,
      upsertLine,
      setQuantity,
      removeLine,
      clear,
    };
  }, [lines]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      'useCart must be used within a CartProvider.',
    );
  }

  return context;
}