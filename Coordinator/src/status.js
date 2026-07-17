'use strict';

const config = require('./config');

// Demo/observability helper: report, for each service the coordinator depends on,
// where it was resolved (Broker discovery vs configured fallback) and whether it
// is currently reachable. Used by the demo UI's service strip.

async function ping(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    // Any HTTP response (even 404) means the port is up.
    await fetch(url, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function brokerLookup(serviceName) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${config.BROKER_URL}/registry/services/${serviceName}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const instances = await res.json();
    return Array.isArray(instances) && instances.length ? instances[0].baseUrl : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getStatus() {
  const brokerUp = await ping(`${config.BROKER_URL}/registry/services`);

  const names = Object.keys(config.SERVICES);
  const services = await Promise.all(
    names.map(async (name) => {
      const discovered = brokerUp ? await brokerLookup(name) : null;
      const baseUrl = discovered || config.SERVICES[name];
      const via = discovered ? 'broker' : 'fallback';
      const reachable = await ping(baseUrl);
      return { name, baseUrl, via, reachable };
    }),
  );

  return {
    coordinator: { name: config.SELF.serviceName, baseUrl: config.SELF.baseUrl },
    broker: { baseUrl: config.BROKER_URL, reachable: brokerUp },
    services,
  };
}

module.exports = { getStatus };
