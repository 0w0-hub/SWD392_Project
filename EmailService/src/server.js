'use strict';

const express = require('express');

// Email Service (Gomaa Fig 22.24) — external service with one operation:
// sendEmail(in emailId, in emailText). This is a demo stand-in: instead of a real
// SMTP transport it records each message in memory and logs it, which is enough
// to show messages M9a (order confirmation) and S8c (shipping confirmation).

const app = express();
app.use(express.json());

const outbox = []; // last-sent emails, newest last

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'EmailService' }));

// sendEmail — body: { to, subject, text }
app.post('/emails', (req, res) => {
  const { to, subject, text } = req.body || {};
  if (!to || !text) {
    return res.status(400).json({ error: 'ValidationError', message: 'to and text are required' });
  }
  const message = { id: outbox.length + 1, to, subject: subject || '(no subject)', text, sentAt: new Date().toISOString() };
  outbox.push(message);
  console.log(`[email] -> ${to}: ${message.subject}`);
  res.status(202).json({ sent: true, message });
});

// Inspect what has been "sent" (handy for the demo / presentation).
app.get('/emails', (_req, res) => res.json(outbox));

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`EmailService listening on http://localhost:${PORT}`);
  registerWithBroker(PORT).catch(() => {});
});

// --- Optional Broker registration (Service Registration pattern) -----------
// Enabled by default; set BROKER_ENABLED=false to skip. Best-effort — the
// service runs fine even if the Broker is down.
async function registerWithBroker(port) {
  if (process.env.BROKER_ENABLED === 'false') return;
  const brokerUrl = process.env.BROKER_URL || 'http://localhost:8080';
  const host = process.env.HOST || 'localhost';
  const baseUrl = `http://${host}:${port}`;
  const serviceId = require('crypto').randomUUID();

  const registration = {
    serviceId,
    serviceName: 'EmailService',
    version: '1.0',
    host,
    port: Number(port),
    baseUrl,
    healthUrl: `${baseUrl}/health`,
    operations: ['sendEmail'],
  };

  const post = (url, body) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  try {
    const res = await post(`${brokerUrl}/registry/services`, registration);
    if (res.ok) {
      console.log(`[broker] registered 'EmailService' (serviceId=${serviceId})`);
      setInterval(() => {
        fetch(`${brokerUrl}/registry/services/${serviceId}/heartbeat`, { method: 'PUT' }).catch(() => {});
      }, 30000).unref();
    }
  } catch {
    console.warn('[broker] EmailService registration failed; running without discovery');
  }
}

module.exports = app;
