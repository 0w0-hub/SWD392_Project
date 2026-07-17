'use strict';

// Broker (service registry) integration — Service Registration pattern
// (Gomaa Sec 22.7.3). On startup the Inventory Service registers itself so that
// coordinators can DISCOVER it by name instead of using a hard-coded URL; it then
// sends a periodic heartbeat and deregisters on shutdown.
//
// Everything here is best-effort: if the Broker is down the service still runs.
// Disable entirely with BROKER_ENABLED=false. Uses Node's global fetch (Node >= 18).

const SERVICE_NAME = 'InventoryService';
const OPERATIONS = ['checkInventory', 'reserveInventory', 'commitInventory', 'abortInventory', 'update'];
const HEARTBEAT_MS = Number(process.env.BROKER_HEARTBEAT_MS || 30000);

let serviceId = null;
let heartbeatTimer = null;

function registration(port) {
  const host = process.env.HOST || 'localhost';
  const baseUrl = `http://${host}:${port}`;
  return {
    serviceId,
    serviceName: SERVICE_NAME,
    version: '1.0',
    host,
    port: Number(port),
    baseUrl,
    healthUrl: `${baseUrl}/health`,
    operations: OPERATIONS,
  };
}

async function register(brokerUrl, port) {
  serviceId = serviceId || require('crypto').randomUUID();
  const res = await fetch(`${brokerUrl}/registry/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registration(port)),
  });
  if (!res.ok) throw new Error(`Broker responded ${res.status}`);
  console.log(`[broker] registered '${SERVICE_NAME}' (serviceId=${serviceId})`);
}

/** Start registration + heartbeat loop. Returns immediately; never throws. */
function start(port) {
  if (process.env.BROKER_ENABLED === 'false') return;
  const brokerUrl = process.env.BROKER_URL || 'http://localhost:8080';

  const tick = async () => {
    try {
      if (!serviceId) {
        await register(brokerUrl, port);
        return;
      }
      const res = await fetch(`${brokerUrl}/registry/services/${serviceId}/heartbeat`, { method: 'PUT' });
      if (res.status === 404) {
        // Broker forgot us (e.g. it restarted) — re-register next tick.
        serviceId = null;
      }
    } catch {
      // Broker unreachable — keep trying on the next tick.
    }
  };

  tick();
  heartbeatTimer = setInterval(tick, HEARTBEAT_MS);
  heartbeatTimer.unref?.();
}

/** Deregister on graceful shutdown. */
async function stop() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (!serviceId) return;
  const brokerUrl = process.env.BROKER_URL || 'http://localhost:8080';
  try {
    await fetch(`${brokerUrl}/registry/services/${serviceId}`, { method: 'DELETE' });
    console.log('[broker] deregistered');
  } catch {
    /* ignore */
  }
}

module.exports = { start, stop };
