
-- Ivy & Pearls commerce schema
-- Supabase / PostgreSQL
create extension if not exists "pgcrypto";
create extension if not exists citext;

create type public.user_role as enum ('customer','admin');
create type public.order_status as enum (
  'pending_payment','paid','fulfilment_pending','submitted_to_zq','processing',
  'shipped','delivered','cancelled','refunded','fulfilment_error'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  role public.user_role not null default 'customer',
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  description text not null default '',
  short_description text not null default '',
  category text not null check (category in ('rings','necklaces','earrings','bracelets')),
  collection text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  featured boolean not null default false,
  ivy_edit boolean not null default false,
  new_arrival boolean not null default false,
  seo_title text,
  seo_description text,
  material_summary text,
  care text,
  origin_note text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_idx on public.products(status, published_at desc);
create index if not exists products_category_idx on public.products(category) where status='active';

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  zq_sku text not null unique,
  zq_product_id bigint,
  zq_spec_id bigint,
  title text not null,
  attributes jsonb not null default '{}'::jsonb,
  price_minor integer not null check (price_minor >= 0),
  compare_at_minor integer check (compare_at_minor is null or compare_at_minor >= 0),
  cost_minor integer,
  cost_currency char(3),
  currency char(3) not null default 'GBP',
  weight_kg numeric(10,3),
  inventory_quantity integer not null default 0,
  inventory_locked integer not null default 0,
  inventory_in_transit integer not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists variants_product_idx on public.product_variants(product_id, sort_order);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  url text not null,
  alt_text text not null default '',
  width integer,
  height integer,
  sort_order integer not null default 0,
  is_primary boolean not null default false
);

create index if not exists product_images_idx on public.product_images(product_id, sort_order);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Delivery',
  first_name text not null,
  last_name text not null,
  company text,
  address1 text not null,
  address2 text,
  city text not null,
  province text not null,
  postcode text not null,
  country_code char(2) not null default 'GB',
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  status public.order_status not null default 'pending_payment',
  zq_status text,
  zq_platform_order_id text,
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  currency char(3) not null default 'GBP',
  subtotal_minor integer not null default 0,
  shipping_minor integer not null default 0,
  discount_minor integer not null default 0,
  total_minor integer not null default 0,
  shipping_address jsonb not null,
  billing_address jsonb,
  tracking_number text,
  domestic_tracking_number text,
  tracking_carrier text,
  customer_note text,
  paid_at timestamptz,
  submitted_to_zq_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status, created_at desc);
create index if not exists orders_zq_idx on public.orders(zq_platform_order_id) where zq_platform_order_id is not null;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  zq_sku text not null,
  product_image text,
  quantity integer not null check (quantity > 0),
  unit_price_minor integer not null check (unit_price_minor >= 0),
  line_total_minor integer not null check (line_total_minor >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, product_id)
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  consent boolean not null,
  source text not null default 'website',
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  order_number text,
  topic text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','open','resolved','spam')),
  created_at timestamptz not null default now()
);

create table if not exists public.journal_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  body_html text not null,
  image_url text,
  image_alt text,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  status text not null default 'draft' check(status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code citext unique not null,
  type text not null check(type in ('percent','fixed')),
  value integer not null check(value > 0),
  minimum_minor integer not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','products','product_variants','addresses','orders','journal_posts']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, first_name, last_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'first_name',''), coalesce(new.raw_user_meta_data->>'last_name',''))
  on conflict(id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin')
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;
alter table public.journal_posts enable row level security;
alter table public.discount_codes enable row level security;

create policy "public active products" on public.products for select using(status='active' or public.is_admin());
create policy "public active variants" on public.product_variants for select using(active or public.is_admin());
create policy "public product images" on public.product_images for select using(true);
create policy "public published journal" on public.journal_posts for select using(status='published' or public.is_admin());

create policy "profile owner read" on public.profiles for select using(auth.uid()=id or public.is_admin());
create policy "profile owner update" on public.profiles for update using(auth.uid()=id or public.is_admin());

create policy "addresses owner" on public.addresses for all using(auth.uid()=user_id or public.is_admin()) with check(auth.uid()=user_id or public.is_admin());
create policy "orders owner read" on public.orders for select using(auth.uid()=user_id or public.is_admin());
create policy "order items owner read" on public.order_items for select using(
  public.is_admin() or exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid())
);
create policy "order events owner read" on public.order_events for select using(
  public.is_admin() or exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid())
);
create policy "wishlist owner" on public.wishlist_items for all using(auth.uid()=user_id or public.is_admin()) with check(auth.uid()=user_id or public.is_admin());

create policy "admin products" on public.products for all using(public.is_admin()) with check(public.is_admin());
create policy "admin variants" on public.product_variants for all using(public.is_admin()) with check(public.is_admin());
create policy "admin images" on public.product_images for all using(public.is_admin()) with check(public.is_admin());
create policy "admin journal" on public.journal_posts for all using(public.is_admin()) with check(public.is_admin());
create policy "admin discounts" on public.discount_codes for all using(public.is_admin()) with check(public.is_admin());
create policy "admin contacts" on public.contact_messages for all using(public.is_admin()) with check(public.is_admin());
create policy "admin newsletter" on public.newsletter_subscribers for all using(public.is_admin()) with check(public.is_admin());

-- No anonymous write policies for orders/contact/newsletter.
-- Writes are performed by the server with the service role after validation/rate limiting.
