'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// SQLite file lives under InventoryService/data/inventory.db
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = process.env.INVENTORY_DB || path.join(dataDir, 'inventory.db');
const db = new Database(dbFile);

// WAL improves concurrency for the reserve/commit/abort updates.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Inventory entity (Gomaa, Fig 22.23).
 *
 *   quantity          = total items physically on hand
 *   quantityReserved  = items reserved by delivery orders but not yet shipped
 *
 * Invariant enforced by CHECK constraints:  0 <= quantityReserved <= quantity
 * Available for a new order = quantity - quantityReserved.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    itemId           INTEGER PRIMARY KEY,
    itemDescription  TEXT    NOT NULL,
    quantity         INTEGER NOT NULL DEFAULT 0,
    quantityReserved INTEGER NOT NULL DEFAULT 0,
    price            REAL    NOT NULL,
    reorderTime      TEXT,
    CHECK (quantityReserved >= 0),
    CHECK (quantityReserved <= quantity)
  );
`);

module.exports = db;
