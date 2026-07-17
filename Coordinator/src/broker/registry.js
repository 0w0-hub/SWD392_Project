'use strict';

const http = require('../http');
const config = require('../config');

// Broker integration (Sec 22.7.3): the coordinator both REGISTERS itself (so other
// clients could discover it) and DISCOVERS the services it depends on.
//
// Discovery is white-pages by service name:  GET /registry/services/{serviceName}
// returns the live instances. We cache the chosen base URL briefly, and fall back
// to the configured URL if the Broker is down or the service has not registered.

const registryBase = () => `${config.BROKER_URL}/registry/services`;

// serviceName -> { baseUrl, expiresAt }
const cache = new Map();

let serviceId = null;
let heartbeatTimer = null;

// ---- Service Discovery -----------------------------------------------------

/**
 * Resolve a service's base URL, preferring a live Broker registration and
 * falling back to the configured URL. Result cached for DISCOVERY_TTL_MS.
 * @param {string} serviceName
 * @returns {Promise<string>} base URL, e.g. "http://localhost:3004"
 */
async function discover(serviceName) {
  const cached = cache.get(serviceName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.baseUrl;
  }

  let baseUrl = null;
  try {
    const instances = await http.get(`${registryBase()}/${serviceName}`, {
      serviceName: 'Broker',
    });
    if (Array.isArray(instances) && instances.length > 0) {
      // Simplest selection policy: first live instance.
      baseUrl = instances[0].baseUrl;
    }
  } catch {
    // Broker unreachable — silently fall through to the configured fallback.
  }

  if (!baseUrl) {
    baseUrl = config.SERVICES[serviceName] || null;
  }
  if (!baseUrl) {
    throw new Error(`Cannot resolve service '${serviceName}' (no registration, no fallback URL)`);
  }

  cache.set(serviceName, {
    baseUrl,
    expiresAt: Date.now() + config.DISCOVERY_TTL_MS,
  });
  return baseUrl;
}

// ---- Self registration -----------------------------------------------------

function buildRegistration(id) {
  const { serviceName, version, host, port, baseUrl } = config.SELF;
  return {
    serviceId: id,
    serviceName,
    version,
    host,
    port,
    baseUrl,
    healthUrl: `${baseUrl}/health`,
    // Operations this coordination layer exposes (yellow-pages entries).
    operations: [
      'browseCatalog',
      'selectItem',
      'makeOrder',
      'viewOrder',
      'processNextOrder',
      'reserveOrder',
      'confirmShipment',
    ],
  };
}

// Node <18.17 lacks crypto.randomUUID on globalThis in some builds; require it.
function newId() {
  return require('crypto').randomUUID();
}

async function register() {
  const id = serviceId || newId();
  try {
    await http.post(registryBase(), buildRegistration(id), { serviceName: 'Broker' });
    serviceId = id;
    console.log(`[broker] registered '${config.SELF.serviceName}' (serviceId=${id})`);
    return true;
  } catch (err) {
    console.warn(
      `[broker] registration failed (${err.message}); coordinator still runs, will retry on next heartbeat`,
    );
    return false;
  }
}

async function heartbeat() {
  if (!serviceId) {
    await register();
    return;
  }
  try {
    // 404 => Broker forgot us (e.g. it restarted) => re-register next tick.
    await http.request('PUT', `${registryBase()}/${serviceId}/heartbeat`, undefined, {
      serviceName: 'Broker',
    });
  } catch (err) {
    if (err.upstreamStatus === 404) {
      console.warn('[broker] heartbeat 404 — re-registering');
      serviceId = null;
      await register();
    }
    // other errors (Broker down): keep serviceId, try again next tick
  }
}

async function start() {
  await register();
  heartbeatTimer = setInterval(() => {
    heartbeat().catch(() => {});
  }, config.HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();
}

async function stop() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (serviceId) {
    await http.del(`${registryBase()}/${serviceId}`, { serviceName: 'Broker' }).catch(() => {});
    console.log('[broker] deregistered');
  }
}

module.exports = { discover, start, stop };
