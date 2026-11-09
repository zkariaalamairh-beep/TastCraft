// Customization choices shown for every menu item.
// Selections are compiled into a short note per order line,
// which the kitchen reads on the order ticket.

export const ITEM_OPTION_GROUPS = [
  {
    id: 'sauce',
    label: 'Sauce',
    type: 'single',
    options: [
      'Regular sauce',
      'No sauce',
      'Sauce on the side',
      'Extra sauce',
    ],
  },
  {
    id: 'adjustments',
    label: 'Adjustments',
    type: 'multi',
    options: [
      'No onions',
      'No pickles',
      'Make it spicy',
      'Extra cheese',
    ],
  },
];

export const MAX_NOTE_LENGTH = 200;

// Compile a line's selections into the note sent to the API.
export function buildItemNote(line) {
  const parts = [];

  const selections = line?.selections ?? {};

  Object.keys(selections).forEach((groupId) => {
    const value = selections[groupId];

    if (typeof value === 'string' && value) {
      parts.push(value);
    } else if (Array.isArray(value)) {
      parts.push(...value);
    }
  });

  if (typeof line?.note === 'string' && line.note.trim()) {
    parts.push(line.note.trim());
  }

  const note = parts.join(', ');

  return note ? note.slice(0, MAX_NOTE_LENGTH) : null;
}