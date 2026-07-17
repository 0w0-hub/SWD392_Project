'use strict';

const path = require('path');
const express = require('express');
const config = require('./config');
const broker = require('./broker/registry');
const { getStatus } = require('./status');
const customerRoutes = require('./interaction/customer.routes');
const supplierRoutes = require('./interaction/supplier.routes');

// Coordination-layer service (Gomaa Ch.22, Layer 2 + Layer 3). Hosts the Customer,
// Supplier and Billing coordinators behind Customer/Supplier Interaction endpoints,
// and discovers the downstream services through the Broker.

const app = express();
app.use(express.json());

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: config.SELF.serviceName }),
);

// Discovery + reachability of every downstream service (drives the demo UI strip).
app.get('/status', (_req, res, next) => {
  getStatus().then((s) => res.json(s)).catch(next);
});

// Demo UI (a Customer/Supplier console that walks the 5 use cases).
app.use(express.static(path.join(__dirname, '..', 'public')));

// Layer 3 — User Interaction components.
app.use('/customer', customerRoutes); // Customer Interaction
app.use('/supplier', supplierRoutes); // Supplier Interaction

// Central error handler: map coordinator/upstream errors to HTTP status codes.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: err.name || 'Error',
    message: err.message,
    ...(err.upstreamBody ? { upstream: err.upstreamBody } : {}),
  });
});

const server = app.listen(config.SELF.port, async () => {
  console.log(`CoordinatorService listening on ${config.SELF.baseUrl}`);
  await broker.start(); // register with the Broker + start heartbeat
});

// Graceful shutdown: deregister from the Broker.
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down`);
  await broker.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
