'use strict';

const { UpstreamError, ServiceUnavailableError } = require('./errors');

// Thin JSON-over-HTTP helper built on Node's global fetch (Node >= 18).
// This is the Synchronous Message Communication with Reply pattern (Sec 22.7.3):
// the coordinator blocks awaiting each service's response before proceeding.

const DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 5000);

function parseBody(text) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * @param {string} method  HTTP verb
 * @param {string} url     absolute URL
 * @param {object} [body]  JSON request body (omit for GET)
 * @param {object} [opts]  { serviceName } used to label connection failures
 */
async function request(method, url, body, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    // Connection refused / DNS / timeout — the service is effectively down.
    throw new ServiceUnavailableError(opts.serviceName || url, err);
  } finally {
    clearTimeout(timer);
  }

  const data = parseBody(await res.text());
  if (!res.ok) {
    throw new UpstreamError(res.status, data, url);
  }
  return data;
}

module.exports = {
  request,
  get: (url, opts) => request('GET', url, undefined, opts),
  post: (url, body, opts) => request('POST', url, body, opts),
  patch: (url, body, opts) => request('PATCH', url, body, opts),
  del: (url, opts) => request('DELETE', url, undefined, opts),
};
