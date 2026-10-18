// ============================================================================
// SMS service — sends vendor notifications and logs every attempt.
//
// Provider: Beem Africa (a Tanzanian SMS gateway). Set in .env:
//   SMS_PROVIDER=beem            (anything else → messages are only printed to the console)
//   BEEM_API_KEY=...  BEEM_SECRET_KEY=...  BEEM_SENDER_ID=SIPIKI
// The sender ID must be registered/approved with Beem and the local carriers.
// Check the request format below against Beem's current API docs before going live.
//
// Design rule: a failed SMS must NEVER block or roll back the business action
// (approving a vendor, etc.). send() therefore never throws — it returns
// { success } and writes a row to sms_logs either way.
// ============================================================================
const prisma = require('../config/db');

const BEEM_URL = 'https://apisms.beem.africa/v1/send';

// Message templates (Swahili). Keep each under ~160 chars to stay in one SMS segment.
const TEMPLATES = {
  application_received: ({ name, ref }) =>
    `Sipiki: Habari ${name}, tumepokea ombi lako la biashara (${ref}). Tutakujulisha baada ya ukaguzi.`,
  approved: ({ name, appUrl }) =>
    `Sipiki: Hongera ${name}! Biashara yako imeidhinishwa. Ingia sasa uanze kuuza: ${appUrl}`,
  rejected: ({ name, reason }) =>
    `Sipiki: Samahani ${name}, ombi lako halijakubaliwa. Sababu: ${reason}. Wasiliana nasi kwa msaada.`,
  suspended: ({ name, reason }) =>
    `Sipiki: Akaunti ya ${name} imesimamishwa. Sababu: ${reason}. Wasiliana nasi kwa msaada.`,
  reactivated: ({ name }) => `Sipiki: Akaunti ya ${name} imerudishwa. Unaweza kuendelea kuuza.`,
};

async function sendViaBeem(toPhone, message) {
  const { BEEM_API_KEY, BEEM_SECRET_KEY, BEEM_SENDER_ID } = process.env;
  if (!BEEM_API_KEY || !BEEM_SECRET_KEY) throw new Error('Beem credentials are not configured');

  const res = await fetch(BEEM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`).toString('base64')}`,
    },
    body: JSON.stringify({
      source_addr: BEEM_SENDER_ID || 'SIPIKI',
      schedule_time: '',
      encoding: 0,
      message,
      recipients: [{ recipient_id: 1, dest_addr: toPhone }], // toPhone is already 255XXXXXXXXX
    }),
    signal: AbortSignal.timeout(10_000), // don't let a slow gateway hang the request
  });

  const bodyText = await res.text();
  if (!res.ok) throw new Error(`Beem responded ${res.status}: ${bodyText.slice(0, 300)}`);
  return bodyText.slice(0, 500);
}

/**
 * Sends a templated SMS and logs it. Never throws.
 * @param {object} opts
 * @param {string} opts.to        normalised phone, 255XXXXXXXXX
 * @param {string} opts.template  key of TEMPLATES
 * @param {object} opts.data      values for the template
 * @param {string} [opts.vendorId] for the audit log
 */
async function sendSms({ to, template, data, vendorId }) {
  const message = TEMPLATES[template]({ appUrl: process.env.APP_URL || '', ...data });
  const provider = process.env.SMS_PROVIDER === 'beem' ? 'beem' : 'console';
  let success = false;
  let providerResponse = null;

  try {
    if (provider === 'beem') {
      providerResponse = await sendViaBeem(to, message);
    } else {
      console.log(`[SMS:console] → ${to}: ${message}`); // dev mode: no real message is sent
      providerResponse = 'printed to console';
    }
    success = true;
  } catch (err) {
    providerResponse = String(err.message).slice(0, 500);
    console.error('SMS send failed:', providerResponse);
  }

  try {
    await prisma.smsLog.create({
      data: { vendorId: vendorId ?? null, toPhone: to, template, message, provider, success, providerResponse },
    });
  } catch (err) {
    console.error('Failed to write sms_logs row:', err.message);
  }

  return { success };
}

module.exports = { sendSms };
