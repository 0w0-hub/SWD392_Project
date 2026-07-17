'use strict';

const delivery = require('../clients/deliveryOrder.client');
const inventory = require('../clients/inventory.client');
const billing = require('./billing.coordinator');
const { UpstreamError } = require('../errors');

// Supplier Coordinator (Fig 22.14, Fig 22.15, Fig 22.28).
//
// Drives the supplier-initiated use cases. It is a client of Delivery Order and
// Inventory services, and communicates with the Billing Coordinator (IShipment)
// to bill the customer during shipment. Provided interface ISupplierCoordinator.

// ---- Use case: Process Delivery Order (messages D3..D14) --------------------

/**
 * D3/D4: select the next delivery order for a supplier.
 * D5/D6: check inventory availability for each order item.
 * @returns {Promise<{order:object, inventory:Array}>}  (D7/D8 output)
 */
async function processNextOrder(supplierId) {
  const order = await delivery.select(supplierId); // D3 -> D4
  const inventoryStatus = [];
  for (const item of order.items || []) {
    // D5 -> D6: item availability info.
    const status = await inventory.checkInventory(item.itemId);
    inventoryStatus.push({ itemId: item.itemId, quantityOrdered: item.quantity, ...status });
  }
  return { order, inventory: inventoryStatus };
}

/**
 * D9..D12: reserve every item of the order in inventory (Prepare To Commit).
 * If any item is out of stock, the reservations made so far are released so the
 * order leaves no partial hold behind. (Alternative sequence: out of stock.)
 * @returns {Promise<{orderId:number, reserved:Array}>}  (D13/D14 output)
 */
async function reserveOrder(orderId) {
  const order = await delivery.read(orderId);
  const reserved = [];
  try {
    for (const item of order.items || []) {
      // D11: reserveInventory (Prepare To Commit). Out of stock => the service
      // returns 409 and we abort the whole reservation.
      const status = await inventory.reserveInventory(item.itemId, item.quantity);
      reserved.push({ itemId: item.itemId, quantity: item.quantity, status });
    }
  } catch (err) {
    // Roll back partial reservations (release the items already held).
    for (const r of reserved) {
      await inventory.abortInventory(r.itemId, r.quantity).catch(() => {});
    }
    throw err;
  }
  return { orderId, reserved };
}

// ---- Use case: Confirm Shipment and Bill Customer (messages S1..S12) --------

/**
 * S1..S3: the supplier confirms the order is ready to ship; the coordinator hands
 * billing to the Billing Coordinator (2PC over credit card + delivery order).
 * S8:     Billing Coordinator reports "Account Billed".
 * S9/S10: the coordinator then commits the inventory (removes reserved items).
 * S11/S12: shipment confirmation is returned to the supplier.
 *
 * If billing aborts, inventory is NOT committed and the failure is propagated.
 */
async function confirmShipment(orderId) {
  const order = await delivery.read(orderId);

  // S3: hand off to Billing Coordinator; this runs the 2PC and throws on abort.
  const billingResult = await billing.orderReadyForShipment(orderId);

  // S9/S10: commit inventory now that payment is committed.
  const committed = [];
  for (const item of order.items || []) {
    const status = await inventory.commitInventory(item.itemId, item.quantity); // S9
    committed.push({ itemId: item.itemId, quantity: item.quantity, status });
  }

  // Finalize shipment: mark the order Shipped (completes the delivery).
  let orderStatus;
  try {
    ({ orderStatus } = await delivery.orderShipped(orderId));
  } catch (err) {
    if (!(err instanceof UpstreamError)) throw err;
    orderStatus = 'Shipped';
  }

  // S11/S12: shipment confirmation.
  return {
    orderId,
    status: 'SHIPPED',
    orderStatus,
    billing: billingResult,
    inventory: committed,
  };
}

module.exports = { processNextOrder, reserveOrder, confirmShipment };
