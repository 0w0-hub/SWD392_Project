'use strict';

/**
 * Service contract for the Inventory Service — the code equivalent of the
 * `IInventoryService` provided interface in Gomaa, Fig 22.23.
 *
 * JavaScript has no `interface` keyword, so the contract is declared here with
 * JSDoc: it documents the operations, gives IDEs type-checking/autocomplete, and
 * lets the implementation (`inventory.service.js`) declare `@implements`. It is a
 * documentation/typing artifact only — it is not imported or run.
 *
 * This service is a *participant* in the two-phase commit driven by the
 * Supplier/Billing coordinators; the 2PC role of each operation is noted below.
 */

/**
 * InventoryStatus value object (Gomaa, Fig 22.23) — returned by every operation.
 * Derived from the Inventory entity, not persisted.
 *
 * @typedef  {Object} InventoryStatus
 * @property {number}       itemId
 * @property {number}       currentAmount        - items on hand now (= quantity)
 * @property {number}       quantityAfterShipped - remaining once reserved items ship
 *                                                  (= quantity - quantityReserved)
 * @property {string|null}  reorderTime          - ISO date string
 */

/**
 * Inventory entity (Gomaa, Fig 22.23) — the persisted stock record.
 *
 * @typedef  {Object} Inventory
 * @property {number}       itemId
 * @property {string}       itemDescription
 * @property {number}       quantity          - total items physically on hand
 * @property {number}       quantityReserved  - reserved but not yet shipped
 * @property {number}       price
 * @property {string|null}  reorderTime
 */

/**
 * @interface IInventoryService
 *
 * @property {(itemId: number) => InventoryStatus} checkInventory
 *   Read-only availability check (msg D5). Throws NotFoundError if item is unknown.
 *
 * @property {(itemId: number, amount: number) => InventoryStatus} reserveInventory
 *   PREPARE TO COMMIT (msg D11): hold `amount` units. Throws ConflictError when the
 *   available stock (quantity - quantityReserved) is insufficient (= vote abort).
 *
 * @property {(itemId: number, amount: number) => InventoryStatus} commitInventory
 *   COMMIT (msg S9): remove `amount` reserved units from stock permanently.
 *   Throws ConflictError if fewer than `amount` units are reserved.
 *
 * @property {(itemId: number, amount: number) => InventoryStatus} abortInventory
 *   ROLLBACK (msg S11): release `amount` held units ("Items Released", S12).
 *   `quantity` is unchanged.
 *
 * @property {(itemId: number, amount: number) => InventoryStatus} update
 *   Replenish stock by `amount` (outside the 2PC).
 */

module.exports = {};
