'use strict';

const express = require('express');
const supplier = require('../coordinators/supplier.coordinator');
const { ValidationError } = require('../errors');

// Supplier Interaction (Fig 22.26) — the user-layer entry point for the supplier.
// Delegates each supplier input to the Supplier Coordinator.

const router = express.Router();

const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function parseId(raw, name) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError(`${name} must be a positive integer`);
  return id;
}

// D1/D2 -> Process Delivery Order: fetch next order + inventory availability.
// GET /supplier/orders/next?supplierId=1
router.get(
  '/orders/next',
  handler(async (req, res) => {
    res.json(await supplier.processNextOrder(parseId(req.query.supplierId, 'supplierId')));
  }),
);

// D9/D10 -> Reserve the order's items in inventory (Prepare To Commit).
// POST /supplier/orders/:orderId/reserve
router.post(
  '/orders/:orderId/reserve',
  handler(async (req, res) => {
    res.json(await supplier.reserveOrder(parseId(req.params.orderId, 'orderId')));
  }),
);

// S1/S2 -> Confirm Shipment and Bill Customer (runs the 2PC billing, then ships).
// POST /supplier/orders/:orderId/confirm-shipment
router.post(
  '/orders/:orderId/confirm-shipment',
  handler(async (req, res) => {
    res.json(await supplier.confirmShipment(parseId(req.params.orderId, 'orderId')));
  }),
);

module.exports = router;
