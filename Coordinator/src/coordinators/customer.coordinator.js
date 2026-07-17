'use strict';

const catalog = require('../clients/catalog.client');
const accounts = require('../clients/account.client');
const creditCard = require('../clients/creditCard.client');
const delivery = require('../clients/deliveryOrder.client');
const email = require('../clients/email.client');
const { ValidationError, UpstreamError } = require('../errors');

// Customer Coordinator (Fig 22.13, Fig 22.27).
//
// Sequences the customer-initiated use cases by talking to Catalog, Customer
// Account, Delivery Order and Email services. Provided interface ICustomerCoordinator.

// ---- Use case: Browse Catalog (messages B3/B4, B9/B10) ---------------------

async function browseCatalog(catalogType) {
  if (!catalogType) throw new ValidationError('catalogType is required');
  // B3 -> B4: request catalog information for the selected type.
  return catalog.requestCatalog(catalogType);
}

async function selectItem(itemId) {
  // B9 -> B10: request the selected item's info (price, description).
  return catalog.requestSelection(itemId);
}

// ---- Use case: Make Order Request (messages M1..M10) -----------------------

/**
 * @param {object} req
 * @param {number} req.accountId   customer account id
 * @param {number} req.supplierId  supplier fulfilling the order
 * @param {Array<{itemId:number, quantity:number, unitCost?:number}>} req.items
 */
async function makeOrder(req) {
  const { accountId, supplierId, items } = req || {};
  if (!accountId) throw new ValidationError('accountId is required');
  if (!supplierId) throw new ValidationError('supplierId is required');
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('items must be a non-empty array');
  }

  // M3, M4: retrieve customer account information (incl. credit details).
  const account = await accounts.requestAccount(accountId);

  // Resolve unit costs (from Catalog if not supplied) and compute the amount due.
  const orderItems = [];
  let amountDue = 0;
  for (const it of items) {
    if (!it.itemId || !it.quantity || it.quantity <= 0) {
      throw new ValidationError('each item needs a positive itemId and quantity');
    }
    let unitCost = it.unitCost;
    if (unitCost == null) {
      try {
        unitCost = (await catalog.requestSelection(it.itemId)).unitCost;
      } catch (err) {
        throw new ValidationError(
          `unitCost for item ${it.itemId} not provided and not found in catalog`,
        );
      }
    }
    orderItems.push({ itemId: it.itemId, unitCost, quantity: it.quantity });
    amountDue += unitCost * it.quantity;
  }
  amountDue = Math.round(amountDue * 100) / 100;

  // M7: create the delivery order first so we have an orderId to authorize
  // against (the account HOLD is keyed by orderId).
  const { orderId } = await delivery.store({
    accountId,
    supplierId,
    amountDue,
    items: orderItems,
  });

  // M5, M6: authorize the credit card via the Credit Card Service (Prepare To
  // Commit for payment). The card id comes from the customer account (M3/M4).
  // On denial (A1), roll the order back.
  const cardId = account.accountNumber || `CARD-${accountId}`;
  let auth;
  try {
    auth = await creditCard.authorizeCharge(cardId, orderId, amountDue);
  } catch (err) {
    await delivery.abort(orderId).catch(() => {});
    if (err instanceof UpstreamError) {
      // e.g. 402 card declined — surface as the customer-facing denial.
      throw new UpstreamError(
        err.upstreamStatus,
        { message: `Credit authorization denied for order ${orderId}: ${err.upstreamBody?.message || err.message}` },
        err.url,
      );
    }
    throw err;
  }

  // Record the authorization id on the order (best-effort).
  if (auth && auth.authorizationId != null) {
    await delivery.update(orderId, { authorizationId: Number(auth.authorizationId) }).catch(() => {});
  }

  // M9a: send order-confirmation email (best-effort).
  await email
    .sendEmail({
      to: account.customerName || `account-${accountId}`,
      subject: `Order ${orderId} confirmed`,
      text: `Order ${orderId} placed for ${amountDue}. Payment authorized (auth ${auth?.authorizationId}).`,
    })
    .catch(() => {});

  // M9, M10: order confirmation returned to Customer Interaction.
  return {
    orderId,
    accountId,
    supplierId,
    amountDue,
    cardId,
    authorizationId: auth?.authorizationId,
    authStatus: auth?.status,
    status: 'ORDER_PLACED',
    items: orderItems,
  };
}

// ---- Use case: View Order (messages V3/V4) ---------------------------------

async function viewOrder(orderId) {
  // V3 -> V4: request the order (and its invoice) from Delivery Order Service.
  const [order, invoice] = await Promise.all([
    delivery.read(orderId),
    delivery.requestInvoice(orderId).catch(() => null),
  ]);
  return { order, invoice };
}

module.exports = { browseCatalog, selectItem, makeOrder, viewOrder };
