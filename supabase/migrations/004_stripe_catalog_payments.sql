-- Ivy & Pearls: Stripe catalogue sync + payment administration.
-- Safe to re-run.

alter table public.products
  add column if not exists stripe_product_id text,
  add column if not exists stripe_sync_status text not null default 'not_synced',
  add column if not exists stripe_sync_error text,
  add column if not exists stripe_synced_at timestamptz;

alter table public.products drop constraint if exists products_stripe_sync_status_check;
alter table public.products add constraint products_stripe_sync_status_check
  check (stripe_sync_status in ('not_synced','syncing','synced','error'));

create unique index if not exists products_stripe_product_uidx
  on public.products(stripe_product_id) where stripe_product_id is not null;

alter table public.product_variants
  add column if not exists stripe_price_id text,
  add column if not exists stripe_price_amount_minor integer,
  add column if not exists stripe_price_currency char(3),
  add column if not exists stripe_price_synced_at timestamptz;

create unique index if not exists variants_stripe_price_uidx
  on public.product_variants(stripe_price_id) where stripe_price_id is not null;

-- Business-safe Stripe settings. Secret keys and webhook signing secrets are intentionally
-- NOT stored here; they stay in server environment variables.
create table if not exists public.payment_settings (
  id smallint primary key default 1 check (id = 1),
  provider text not null default 'stripe' check (provider = 'stripe'),
  enabled boolean not null default false,
  mode text not null default 'test' check (mode in ('test','live')),
  test_publishable_key text,
  live_publishable_key text,
  currency char(3) not null default 'GBP',
  automatic_payment_methods boolean not null default true,
  receipt_emails boolean not null default true,
  minimum_order_minor integer not null default 50 check (minimum_order_minor >= 0),
  statement_descriptor text,
  updated_at timestamptz not null default now()
);

insert into public.payment_settings(id) values (1)
on conflict(id) do nothing;

create table if not exists public.stripe_webhook_events (
  id bigserial primary key,
  stripe_event_id text not null unique,
  event_type text not null,
  livemode boolean not null default false,
  success boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_created_idx
  on public.stripe_webhook_events(created_at desc);

alter table public.payment_settings enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "admin payment settings" on public.payment_settings;
drop policy if exists "admin stripe webhook events" on public.stripe_webhook_events;
create policy "admin payment settings" on public.payment_settings
  for all using(public.is_admin()) with check(public.is_admin());
create policy "admin stripe webhook events" on public.stripe_webhook_events
  for select using(public.is_admin());
