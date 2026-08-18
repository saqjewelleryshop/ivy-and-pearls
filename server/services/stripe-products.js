import Stripe from 'stripe';
import { supabaseAdmin } from '../lib/supabase.js';

function envForMode(mode) {
  const live = mode === 'live';
  return {
    secretKey: live
      ? (process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '')
      : (process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || ''),
    webhookSecret: live
      ? (process.env.STRIPE_LIVE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '')
      : (process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '')
  };
}

export async function getPaymentSettings() {
  const db = supabaseAdmin();
  const { data, error } = await db.from('payment_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data || {
    id: 1,
    enabled: false,
    mode: 'test',
    currency: 'GBP',
    automatic_payment_methods: true,
    receipt_emails: true,
    minimum_order_minor: 50
  };
}

export async function getStripeRuntimeConfig() {
  const settings = await getPaymentSettings();
  const env = envForMode(settings.mode);
  const publishableKey = settings.mode === 'live'
    ? settings.live_publishable_key
    : settings.test_publishable_key;
  return { settings, publishableKey: publishableKey || '', ...env };
}

export async function stripeClientForCurrentMode() {
  const runtime = await getStripeRuntimeConfig();
  if (!runtime.secretKey) {
    throw Object.assign(new Error(`Stripe ${runtime.settings.mode} secret key is not configured on the server.`), { status: 503 });
  }
  return { stripe: new Stripe(runtime.secretKey), runtime };
}

export function stripeClientForSecret(secretKey) {
  return new Stripe(secretKey);
}

function cleanText(value, max = 500) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function primaryImage(product) {
  return [...(product.product_images || [])]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (a.sort_order || 0) - (b.sort_order || 0))[0]?.url || null;
}

async function loadStripeProduct(productId) {
  const db = supabaseAdmin();
  const { data, error } = await db.from('products').select(`
    *,
    product_variants(*),
    product_images(*)
  `).eq('id', productId).single();
  if (error) throw error;
  return data;
}

async function createOrUpdatePrice({ stripe, db, stripeProductId, product, variant, currency }) {
  const amount = Number(variant.price_minor);
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`Variant ${variant.sku} has an invalid retail price.`);

  const samePrice = variant.stripe_price_id
    && Number(variant.stripe_price_amount_minor) === amount
    && String(variant.stripe_price_currency || '').toUpperCase() === currency;

  if (samePrice) return variant.stripe_price_id;

  if (variant.stripe_price_id) {
    // Stripe Price amounts are not mutable. Archive the old price and create a replacement.
    await stripe.prices.update(variant.stripe_price_id, { active: false }).catch(() => null);
  }

  const price = await stripe.prices.create({
    product: stripeProductId,
    currency: currency.toLowerCase(),
    unit_amount: amount,
    nickname: variant.title || variant.sku,
    metadata: {
      ivy_product_id: product.id,
      ivy_variant_id: variant.id,
      sku: variant.sku || ''
    }
  }, { idempotencyKey: `ivy-price-${variant.id}-${currency}-${amount}` });

  const { error } = await db.from('product_variants').update({
    stripe_price_id: price.id,
    stripe_price_amount_minor: amount,
    stripe_price_currency: currency,
    stripe_price_synced_at: new Date().toISOString()
  }).eq('id', variant.id);
  if (error) throw error;
  return price.id;
}

export async function syncProductToStripe(productId) {
  const db = supabaseAdmin();
  const product = await loadStripeProduct(productId);
  const activeVariants = (product.product_variants || []).filter(v => v.active);
  if (!activeVariants.length) throw new Error('Publish requires at least one active product variant.');
  for (const v of activeVariants) {
    if (!Number.isInteger(Number(v.price_minor)) || Number(v.price_minor) < 0) {
      throw new Error(`Variant ${v.sku || v.title} needs a valid retail price before publishing.`);
    }
  }

  const { stripe, runtime } = await stripeClientForCurrentMode();
  if (!runtime.settings.enabled) throw new Error('Stripe payments are disabled in Admin → Payments.');
  const currency = String(runtime.settings.currency || 'GBP').toUpperCase();

  await db.from('products').update({ stripe_sync_status: 'syncing', stripe_sync_error: null }).eq('id', productId);

  try {
    const image = primaryImage(product);
    const payload = {
      name: product.title,
      description: cleanText(product.short_description || product.description, 500) || undefined,
      active: true,
      metadata: {
        ivy_product_id: product.id,
        slug: product.slug,
        internal_sku: product.internal_sku || '',
        source: 'ivy-and-pearls'
      },
      ...(image ? { images: [image] } : {})
    };

    let stripeProductId = product.stripe_product_id;
    if (stripeProductId) {
      await stripe.products.update(stripeProductId, payload);
    } else {
      const created = await stripe.products.create(payload, { idempotencyKey: `ivy-product-${product.id}` });
      stripeProductId = created.id;
      const { error } = await db.from('products').update({ stripe_product_id: stripeProductId }).eq('id', product.id);
      if (error) throw error;
    }

    const priceIds = {};
    for (const variant of activeVariants) {
      priceIds[variant.id] = await createOrUpdatePrice({ stripe, db, stripeProductId, product, variant, currency });
    }

    const now = new Date().toISOString();
    const { error } = await db.from('products').update({
      stripe_sync_status: 'synced',
      stripe_sync_error: null,
      stripe_synced_at: now
    }).eq('id', product.id);
    if (error) throw error;

    return { stripeProductId, priceIds, syncedAt: now, mode: runtime.settings.mode };
  } catch (error) {
    await db.from('products').update({
      stripe_sync_status: 'error',
      stripe_sync_error: String(error.message || error).slice(0, 2000)
    }).eq('id', productId);
    throw error;
  }
}

export async function setStripeProductActive(productId, active) {
  const product = await loadStripeProduct(productId);
  if (!product.stripe_product_id) return { ok: true, skipped: true };
  const { stripe } = await stripeClientForCurrentMode();
  await stripe.products.update(product.stripe_product_id, { active: Boolean(active) });
  return { ok: true };
}

export async function testStripeConnection() {
  const { stripe, runtime } = await stripeClientForCurrentMode();
  const account = await stripe.accounts.retrieve();
  return {
    ok: true,
    mode: runtime.settings.mode,
    accountId: account.id,
    country: account.country,
    defaultCurrency: account.default_currency,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled)
  };
}

export function configuredSecretsStatus() {
  return {
    testSecretConfigured: Boolean(process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY),
    liveSecretConfigured: Boolean(process.env.STRIPE_LIVE_SECRET_KEY),
    testWebhookConfigured: Boolean(process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET),
    liveWebhookConfigured: Boolean(process.env.STRIPE_LIVE_WEBHOOK_SECRET)
  };
}

export function webhookSecrets() {
  return [
    { mode: 'test', secret: process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '' },
    { mode: 'live', secret: process.env.STRIPE_LIVE_WEBHOOK_SECRET || '' }
  ].filter(x => x.secret);
}
