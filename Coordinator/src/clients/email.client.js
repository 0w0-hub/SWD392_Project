'use strict';

const http = require('../http');
const { discover } = require('../broker/registry');

// Client for Email Service (Fig 22.24). Discovered under "EmailService".
// Email is best-effort: a failure to send must never abort the purchase flow, so
// callers wrap this in .catch(). sendEmail(in emailId, in emailText) — M9a / S8c.
const NAME = 'EmailService';

module.exports = {
  async sendEmail({ to, subject, text }) {
    const base = await discover(NAME);
    return http.post(`${base}/emails`, { to, subject, text }, { serviceName: NAME });
  },
};
