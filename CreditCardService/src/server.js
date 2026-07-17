'use strict';

const express = require('express');

// Credit Card Service (Gomaa Fig 22.24) — external service with the provided
// interface ICreditCardService:
//   authorizeCharge (in creditcardId, in amount, out authorizationResponse)  -- M5
//   commitCharge    (in creditcardId, in amount, out chargeResponse)         -- S8a
//   abortCharge     (in creditcardId, in amount, out chargeResponse)
//
// This is a demo stand-in for a real card network: it keeps authorizations in
// memory, keyed by orderId, and moves each one through the lifecycle
//   AUTHORIZED -> CHARGED     (commit)
//   AUTHORIZED -> ABORTED     (abort)
// mirroring the two-phase-commit role of a participant. Every operation is
// idempotent by orderId, so a retry after a mid-commit crash is safe.

const app = express();
app.use(express.json());

// Simulated per-request credit limit; an amount above this is DECLINED so the
// "credit card denied" alternative (Make Order A1) can be demonstrated. A card id
// containing "DECLINE" is always declined.
const CREDIT_LIMIT = Number(process.env.CREDIT_LIMIT || 1_000_000);

/** orderId -> { orderId, cardId, amount, authorizationId, status } */
const authorizations = new Map();

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'CreditCardService' }));

// authorizeCharge — POST /authorizations { cardId, orderId, amount }
// Prepare To Commit for payment (message M5). Idempotent by orderId.
app.post('/authorizations', (req, res) => {
  const { cardId, orderId, amount } = req.body || {};
  if (!cardId || orderId == null || amount == null) {
    return res.status(400).json({ error: 'ValidationError', message: 'cardId, orderId and amount are required' });
  }
  const key = String(orderId);

  const existing = authorizations.get(key);
  if (existing) return res.status(200).json(existing); // idempotent replay

  if (Number(amount) <= 0) {
    return res.status(400).json({ error: 'ValidationError', message: 'amount must be > 0' });
  }
  // Vote to abort: declined card / over limit.
  if (String(cardId).includes('DECLINE') || Number(amount) > CREDIT_LIMIT) {
    return res.status(402).json({
      error: 'CardDeclined',
      message: `Charge of ${amount} on card ${cardId} was declined`,
    });
  }

  const record = {
    orderId: key,
    cardId,
    amount: Number(amount),
    authorizationId: authorizations.size + 1,
    status: 'AUTHORIZED',
  };
  authorizations.set(key, record);
  console.log(`[creditcard] AUTHORIZED order ${key} card ${cardId} amount ${amount}`);
  res.status(201).json(record);
});

// commitCharge — POST /authorizations/:orderId/commit (message S8a). Idempotent.
app.post('/authorizations/:orderId/commit', (req, res) => {
  const record = authorizations.get(String(req.params.orderId));
  if (!record) return res.status(404).json({ error: 'NotFound', message: 'No authorization for that order' });
  if (record.status === 'ABORTED') {
    return res.status(409).json({ error: 'Conflict', message: 'Authorization was aborted; cannot charge' });
  }
  record.status = 'CHARGED';
  console.log(`[creditcard] CHARGED order ${record.orderId} amount ${record.amount}`);
  res.json(record);
});

// abortCharge — POST /authorizations/:orderId/abort. Idempotent.
app.post('/authorizations/:orderId/abort', (req, res) => {
  const record = authorizations.get(String(req.params.orderId));
  if (!record) return res.status(404).json({ error: 'NotFound', message: 'No authorization for that order' });
  if (record.status === 'CHARGED') {
    return res.status(409).json({ error: 'Conflict', message: 'Already charged; use a refund instead' });
  }
  record.status = 'ABORTED';
  console.log(`[creditcard] ABORTED order ${record.orderId}`);
  res.json(record);
});

app.get('/authorizations/:orderId', (req, res) => {
  const record = authorizations.get(String(req.params.orderId));
  if (!record) return res.status(404).json({ error: 'NotFound', message: 'No authorization for that order' });
  res.json(record);
});

app.get('/authorizations', (_req, res) => res.json([...authorizations.values()]));

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`CreditCardService listening on http://localhost:${PORT}`);
  registerWithBroker(PORT).catch(() => {});
});

// --- Optional Broker registration (Service Registration pattern) -----------
async function registerWithBroker(port) {
  if (process.env.BROKER_ENABLED === 'false') return;
  const brokerUrl = process.env.BROKER_URL || 'http://localhost:8080';
  const host = process.env.HOST || 'localhost';
  const baseUrl = `http://${host}:${port}`;
  const serviceId = require('crypto').randomUUID();

  const registration = {
    serviceId,
    serviceName: 'CreditCardService',
    version: '1.0',
    host,
    port: Number(port),
    baseUrl,
    healthUrl: `${baseUrl}/health`,
    operations: ['authorizeCharge', 'commitCharge', 'abortCharge'],
  };

  try {
    const res = await fetch(`${brokerUrl}/registry/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registration),
    });
    if (res.ok) {
      console.log(`[broker] registered 'CreditCardService' (serviceId=${serviceId})`);
      setInterval(() => {
        fetch(`${brokerUrl}/registry/services/${serviceId}/heartbeat`, { method: 'PUT' }).catch(() => {});
      }, 30000).unref();
    }
  } catch {
    console.warn('[broker] CreditCardService registration failed; running without discovery');
  }
}

module.exports = app;
