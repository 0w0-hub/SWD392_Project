'use strict';

const db = require('../db');

// Data-access layer: raw SQL via better-sqlite3 prepared statements.
// The reserve/commit updates carry their guard in the WHERE clause so the
// check-and-write is a single atomic statement (no read-then-write race).

const stmtFindById = db.prepare('SELECT * FROM inventory WHERE itemId = ?');

const stmtReserve = db.prepare(`
  UPDATE inventory
     SET quantityReserved = quantityReserved + @amount
   WHERE itemId = @itemId
     AND (quantity - quantityReserved) >= @amount
`);

const stmtCommit = db.prepare(`
  UPDATE inventory
     SET quantity         = quantity - @amount,
         quantityReserved = quantityReserved - @amount
   WHERE itemId = @itemId
     AND quantityReserved >= @amount
`);

const stmtAbort = db.prepare(`
  UPDATE inventory
     SET quantityReserved = MAX(0, quantityReserved - @amount)
   WHERE itemId = @itemId
`);

const stmtAddStock = db.prepare(`
  UPDATE inventory
     SET quantity = quantity + @amount
   WHERE itemId = @itemId
`);

const stmtInsert = db.prepare(`
  INSERT INTO inventory (itemId, itemDescription, quantity, quantityReserved, price, reorderTime)
  VALUES (@itemId, @itemDescription, @quantity, @quantityReserved, @price, @reorderTime)
  ON CONFLICT(itemId) DO UPDATE SET
    itemDescription  = excluded.itemDescription,
    quantity         = excluded.quantity,
    quantityReserved = excluded.quantityReserved,
    price            = excluded.price,
    reorderTime      = excluded.reorderTime
`);

module.exports = {
  findById(itemId) {
    return stmtFindById.get(itemId);
  },

  // Returns number of rows changed (0 => guard failed).
  reserve(itemId, amount) {
    return stmtReserve.run({ itemId, amount }).changes;
  },

  commit(itemId, amount) {
    return stmtCommit.run({ itemId, amount }).changes;
  },

  abort(itemId, amount) {
    return stmtAbort.run({ itemId, amount }).changes;
  },

  addStock(itemId, amount) {
    return stmtAddStock.run({ itemId, amount }).changes;
  },

  upsert(item) {
    return stmtInsert.run({
      itemId: item.itemId,
      itemDescription: item.itemDescription,
      quantity: item.quantity ?? 0,
      quantityReserved: item.quantityReserved ?? 0,
      price: item.price,
      reorderTime: item.reorderTime ?? null,
    });
  },
};
