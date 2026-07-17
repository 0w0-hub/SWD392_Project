'use strict';

const express = require('express');
const customer = require('../coordinators/customer.coordinator');
const { ValidationError } = require('../errors');

// Customer Interaction (Fig 22.26) — the user-layer entry point for the customer.
// Each route corresponds to a customer input message and delegates to the
// Customer Coordinator, then returns its reply to the customer.

const router = express.Router();

const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function parseId(raw, name) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(`${name} must be a positive integer`);
  return id;
}

// B1/B2 -> Browse Catalog. GET /customer/catalog?type=Books
router.get(
  '/catalog',
  handler(async (req, res) => {
    res.json(await customer.browseCatalog(req.query.type));
  }),
);

// B7/B8 -> Select item. GET /customer/catalog/item/:itemId
router.get(
  '/catalog/item/:itemId',
  handler(async (req, res) => {
    res.json(await customer.selectItem(parseId(req.params.itemId, 'itemId')));
  }),
);

// M1/M2 -> Make Order Request. POST /customer/orders
// body: { accountId, supplierId, items: [{ itemId, quantity, unitCost? }] }
router.post(
  '/orders',
  handler(async (req, res) => {
    res.status(201).json(await customer.makeOrder(req.body));
  }),
);

// V1/V2 -> View Order. GET /customer/orders/:orderId
router.get(
  '/orders/:orderId',
  handler(async (req, res) => {
    res.json(await customer.viewOrder(parseId(req.params.orderId, 'orderId')));
  }),
);

module.exports = router;
