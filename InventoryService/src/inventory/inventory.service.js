'use strict';

const db = require('../db');
const repo = require('./inventory.repository');
const { NotFoundError, ConflictError } = require('../errors');

// Business logic for the Inventory Service — implements IInventoryService
// (Gomaa, Fig 22.23; contract declared in ./iinventory.service.js). Each write is
// a single atomic SQL statement whose guard lives in the WHERE clause; existence
// check + guarded write are wrapped in a transaction so concurrent orders can't
// interleave between the two steps.

/**
 * @typedef {import('./iinventory.service').IInventoryService} IInventoryService
 * @typedef {import('./iinventory.service').InventoryStatus} InventoryStatus
 */

/**
 * Build the InventoryStatus value object (Gomaa, Fig 22.23) from an inventory row.
 *   currentAmount        = quantity                       (items on hand right now)
 *   quantityAfterShipped = quantity - quantityReserved    (what remains once the
 *                          currently reserved/pending items ship)
 */
function toInventoryStatus(row) {
  return {
    itemId: row.itemId,
    currentAmount: row.quantity,
    quantityAfterShipped: row.quantity - row.quantityReserved,
    reorderTime: row.reorderTime,
  };
}

function getOrThrow(itemId) {
  const row = repo.findById(itemId);
  if (!row) {
    throw new NotFoundError(`Inventory item ${itemId} not found`);
  }
  return row;
}

// checkInventory (D5) — read-only availability check.
function checkInventory(itemId) {
  return toInventoryStatus(getOrThrow(itemId));
}

// reserveInventory (D11) — PREPARE TO COMMIT: hold the items.
// Guard fails => out of stock => vote abort.
const reserveInventory = db.transaction((itemId, amount) => {
  getOrThrow(itemId);
  const changed = repo.reserve(itemId, amount);
  if (changed === 0) {
    throw new ConflictError(
      `Out of stock: item ${itemId} does not have ${amount} unit(s) available to reserve`,
    );
  }
  return toInventoryStatus(repo.findById(itemId));
});

// commitInventory (S9) — COMMIT: remove reserved items from stock for good.
const commitInventory = db.transaction((itemId, amount) => {
  getOrThrow(itemId);
  const changed = repo.commit(itemId, amount);
  if (changed === 0) {
    throw new ConflictError(
      `Cannot commit ${amount} unit(s) for item ${itemId}: not enough reserved`,
    );
  }
  return toInventoryStatus(repo.findById(itemId));
});

// abortInventory (S11) — ROLLBACK: release the reservation ("Items Released", S12).
// quantity is untouched; only the held units go back to available.
const abortInventory = db.transaction((itemId, amount) => {
  getOrThrow(itemId);
  repo.abort(itemId, amount);
  return toInventoryStatus(repo.findById(itemId));
});

// update — replenish stock (outside the 2PC; used when inventory is restocked).
const update = db.transaction((itemId, amount) => {
  getOrThrow(itemId);
  repo.addStock(itemId, amount);
  return toInventoryStatus(repo.findById(itemId));
});

/** @type {IInventoryService} */
module.exports = {
  checkInventory,
  reserveInventory,
  commitInventory,
  abortInventory,
  update,
};
