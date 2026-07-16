'use strict';

const express = require('express');
const service = require('./inventory.service');
const { ValidationError } = require('../errors');

const router = express.Router();

// --- input parsing helpers -------------------------------------------------

function parseItemId(raw) {
  const itemId = Number(raw);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new ValidationError('itemId must be a positive integer');
  }
  return itemId;
}

function parseAmount(body) {
  const amount = Number(body?.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError('amount must be a positive integer');
  }
  return amount;
}

// Wrap sync handlers so thrown domain errors reach the error middleware.
const handler = (fn) => (req, res, next) => {
  try {
    fn(req, res);
  } catch (err) {
    next(err);
  }
};

// --- routes (map to IInventoryService, Fig 22.23) --------------------------

// checkInventory (D5)
router.get(
  '/:itemId/check',
  handler((req, res) => {
    const itemId = parseItemId(req.params.itemId);
    res.json(service.checkInventory(itemId));
  }),
);

// reserveInventory (D11) — prepare to commit
router.post(
  '/:itemId/reserve',
  handler((req, res) => {
    const itemId = parseItemId(req.params.itemId);
    const amount = parseAmount(req.body);
    res.json(service.reserveInventory(itemId, amount));
  }),
);

// commitInventory (S9) — commit
router.post(
  '/:itemId/commit',
  handler((req, res) => {
    const itemId = parseItemId(req.params.itemId);
    const amount = parseAmount(req.body);
    res.json(service.commitInventory(itemId, amount));
  }),
);

// abortInventory (S11) — rollback / "Items Released" (S12)
router.post(
  '/:itemId/abort',
  handler((req, res) => {
    const itemId = parseItemId(req.params.itemId);
    const amount = parseAmount(req.body);
    res.json(service.abortInventory(itemId, amount));
  }),
);

// update — replenish stock
router.patch(
  '/:itemId',
  handler((req, res) => {
    const itemId = parseItemId(req.params.itemId);
    const amount = parseAmount(req.body);
    res.json(service.update(itemId, amount));
  }),
);

module.exports = router;
