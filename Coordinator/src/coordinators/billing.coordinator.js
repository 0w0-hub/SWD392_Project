'use strict';

const creditCard = require('../clients/creditCard.client');
const delivery = require('../clients/deliveryOrder.client');
const email = require('../clients/email.client');
const { TransactionAbortedError, UpstreamError } = require('../errors');

// Billing Coordinator (Fig 22.15, Fig 22.29).
//
// Coordinates billing for a shipped order using the Two-Phase Commit protocol
// (Sec 22.7.3): the updates to the credit card and the delivery order must be
// atomic — either both commit or both abort.
//
// Participants:
//   - Credit Card    == the authorization created at order time (authorize in M5),
//                       committed here via the Credit Card Service (S8a).
//   - Delivery Order == the order record (prepare in S4, commit payment in S8b).
//
// Provided interface IShipment: orderReadyForShipment(orderId) — message S3.

/**
 * Run the 2PC billing for an order that the supplier marked ready to ship.
 * @returns {Promise<{committed:true, invoice:object, charge:object}>}
 * @throws {TransactionAbortedError} if any participant votes to abort (rolled back)
 */
async function orderReadyForShipment(orderId) {
  const oid = String(orderId);

  // ---- Phase 1: PREPARE (gather votes) ------------------------------------
  let invoice;
  let authorization;
  try {
    // S4: Delivery Order — prepare to commit; S5: read back the invoice (its vote).
    await delivery.prepareToCommitOrder(orderId);
    invoice = await delivery.requestInvoice(orderId);

    // S6/S7: Credit Card — the authorization created at order time is its vote.
    // It must still be AUTHORIZED (not aborted) for billing to proceed.
    authorization = await creditCard.getCharge(oid);
    if (authorization.status === 'ABORTED') {
      throw new TransactionAbortedError(
        `Order ${orderId}: payment authorization was aborted — cannot bill`,
      );
    }
  } catch (err) {
    // A participant failed to prepare -> abort everything prepared so far.
    await rollback(orderId);
    if (err instanceof TransactionAbortedError) throw err;
    if (err instanceof UpstreamError) {
      throw new TransactionAbortedError(
        `Order ${orderId}: prepare phase failed (${err.message}) — transaction aborted`,
      );
    }
    throw err;
  }

  // ---- Phase 2: COMMIT (all voted yes) ------------------------------------
  // Idempotent operations, so a retry after a mid-commit crash is safe.
  // S8a: Commit Charge — charge the card for real via the Credit Card Service.
  const charge = await creditCard.commitCharge(oid);
  // S8b: Commit Payment — record payment on the delivery order.
  await delivery.confirmPayment(orderId, invoice.amountDue);
  // S8c: Send shipping-confirmation email (best-effort).
  await email
    .sendEmail({
      to: `account-${invoice.accountId}`,
      subject: `Order ${orderId} shipped`,
      text: `Your order ${orderId} has been billed (${invoice.amountDue}) and is being shipped.`,
    })
    .catch(() => {});

  return { committed: true, invoice, charge };
}

// Roll back the prepare phase: abort the authorization and return the order to
// its pre-shipment state. Both are idempotent and best-effort.
async function rollback(orderId) {
  await creditCard.abortCharge(String(orderId)).catch(() => {});
  await delivery.abort(orderId).catch(() => {});
}

module.exports = { orderReadyForShipment };
