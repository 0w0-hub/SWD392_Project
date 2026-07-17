'use strict';

require('./db'); // open connection + create table on startup
const express = require('express');
const inventoryRouter = require('./inventory/inventory.routes');
const broker = require('./broker');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'inventory' }));
app.use('/inventory', inventoryRouter);

// Central error handler: map domain errors to HTTP status codes.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).json({ error: err.name || 'Error', message: err.message });
});

const PORT = process.env.PORT || 3004;
const server = app.listen(PORT, () => {
  console.log(`InventoryService listening on http://localhost:${PORT}`);
  broker.start(PORT); // register with Broker so coordinators can discover us
});

// Graceful shutdown: deregister from the Broker.
async function shutdown() {
  await broker.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
