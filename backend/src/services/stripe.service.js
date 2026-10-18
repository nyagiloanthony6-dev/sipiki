// ============================================================================
// Stripe Connect Service
// ----------------------------------------------------------------------------
// STRATEGY: "Separate Charges and Transfers"
// The customer's card is charged ONCE by the platform for the full cart total.
// Money is collected into the PLATFORM's Stripe balance. After the order is
// confirmed (webhook: payment_intent.succeeded), the platform creates a
// separate `Transfer` to each vendor's connected account for their share,
// minus the platform's commission. This is the recommended approach for
// marketplaces where a single cart can span multiple vendors, because Stripe
// Connect's `transfer_data` on a PaymentIntent only supports ONE destination.
// ============================================================================
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const prisma = require('../config/db');

/**
 * Creates a vendor's Stripe Express connected account and returns an
 * onboarding link. Called when a vendor signs up to sell on the platform.
 */
async function createVendorConnectAccount(vendor) {
  const account = await stripe.accounts.create({
    type: 'express',
    email: vendor.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { stripeAccountId: account.id },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.APP_URL}/vendor/onboarding/refresh`,
    return_url: `${process.env.APP_URL}/vendor/dashboard`,
    type: 'account_onboarding',
  });

  return accountLink.url;
}

/**
 * Creates a single PaymentIntent for the customer's ENTIRE cart (which may
 * contain products from several vendors). The platform is the merchant of
 * record here; per-vendor splitting happens afterward via `payoutVendors`.
 */
async function createCheckoutPaymentIntent({ orderId, totalCents, currency, customerId }) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency,
    customer: customerId, // Stripe Customer id, for saved payment methods
    metadata: { orderId }, // lets the webhook map back to our Order row
    automatic_payment_methods: { enabled: true },
  });

  await prisma.transaction.create({
    data: {
      orderId,
      stripePaymentIntentId: paymentIntent.id,
      amountCents: totalCents,
      currency,
      status: 'requires_payment',
    },
  });

  return paymentIntent; // client_secret is used by the frontend Stripe Elements form
}

/**
 * Called after a PaymentIntent succeeds (via webhook). Splits the order total
 * across vendors: for each vendor's line items in the order, calculates their
 * share, deducts the platform commission, and issues a Stripe Transfer.
 */
async function payoutVendors(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { vendor: true } },
      transactions: true,
    },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);

  const transaction = order.transactions[0];

  // Group order items by vendor to compute each vendor's gross subtotal
  const vendorTotals = {}; // vendorId -> { grossCents, vendor }
  for (const item of order.items) {
    if (!vendorTotals[item.vendorId]) {
      vendorTotals[item.vendorId] = { grossCents: 0, vendor: item.vendor };
    }
    vendorTotals[item.vendorId].grossCents += item.subtotalCents;
  }

  const payouts = [];

  for (const vendorId of Object.keys(vendorTotals)) {
    const { grossCents, vendor } = vendorTotals[vendorId];
    const commissionRate = Number(vendor.commissionRate) / 100; // e.g. 10.00 -> 0.10
    const feeCents = Math.round(grossCents * commissionRate);
    const netCents = grossCents - feeCents;

    if (!vendor.stripeAccountId) {
      console.error(`Vendor ${vendorId} has no connected Stripe account; skipping transfer`);
      continue;
    }

    // Move funds from the platform balance to the vendor's connected account
    const transfer = await stripe.transfers.create({
      amount: netCents,
      currency: order.currency,
      destination: vendor.stripeAccountId,
      source_transaction: transaction.stripePaymentIntentId, // ties transfer to the original charge
      metadata: { orderId, vendorId },
    });

    const payout = await prisma.vendorPayout.create({
      data: {
        vendorId,
        orderId,
        transactionId: transaction.id,
        grossAmountCents: grossCents,
        platformFeeCents: feeCents,
        netAmountCents: netCents,
        stripeTransferId: transfer.id,
        status: 'in_transit',
      },
    });

    payouts.push(payout);
  }

  return payouts;
}

module.exports = { createVendorConnectAccount, createCheckoutPaymentIntent, payoutVendors };
