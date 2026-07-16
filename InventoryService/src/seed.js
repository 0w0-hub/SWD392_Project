'use strict';

// Seed a few sample inventory items for quick testing.
// Run with:  npm run seed

const db = require('./db');
const repo = require('./inventory/inventory.repository');

const items = [
  {
    itemId: 1001,
    itemDescription: 'UML Distilled (book)',
    quantity: 50,
    quantityReserved: 0,
    price: 39.99,
    reorderTime: '2026-08-01',
  },
  {
    itemId: 1002,
    itemDescription: 'Mechanical Keyboard',
    quantity: 12,
    quantityReserved: 0,
    price: 89.0,
    reorderTime: '2026-07-20',
  },
  {
    itemId: 1003,
    itemDescription: 'Wireless Mouse',
    quantity: 3,
    quantityReserved: 0,
    price: 24.5,
    reorderTime: '2026-07-18',
  },
];

const seed = db.transaction((rows) => {
  for (const row of rows) {
    repo.upsert(row);
  }
});

seed(items);
console.log(`Seeded ${items.length} inventory items:`);
for (const item of items) {
  console.log(`  #${item.itemId}  ${item.itemDescription}  (qty ${item.quantity})`);
}
