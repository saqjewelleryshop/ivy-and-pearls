-- Ivy & Pearls rich merchandising + supplier-sync layer
-- Keeps ZQ supplier data separate from customer-facing catalogue data.

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check
  check (status in ('draft','needs_review','ready','active','archived','supplier_unavailable'));

alter table public.products
  add column if not exists visibility text not null default 'catalog_search'
    check (visibility in ('catalog_search','catalog','search','hidden')),
  add column if not exists product_type text not null default 'variable'
    check (product_type in ('simple','variable')),
  add column if not exists internal_sku text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists canonical_url text,
  add column if not exists og_title text,
  add column if not exists og_description text,
  add column if not exists og_image_url text,
  add column if not exists meta_robots text not null default 'index,follow',
  add column if not exists tax_class text not null default 'standard',
  add column if not exists country_of_origin text,
  add column if not exists lead_time text,
  add column if not exists dimensions jsonb not null default '{}'::jsonb,
  add column if not exists custom_meta jsonb not null default '{}'::jsonb,
  add column if not exists purchase_note text,
  add column if not exists menu_order integer not null default 0,
  add column if not exists reviews_enabled boolean not null default true,
  add column if not exists zq_product_id bigint,
  add column if not exists zq_source_status text,
  add column if not exists zq_last_synced_at timestamptz,
  add column if not exists zq_raw jsonb,
  add column if not exists sync_inventory boolean not null default true,
  add column if not exists sync_cost boolean not null default true,
  add column if not exists sync_weight boolean not null default true,
  add column if not exists sync_supplier_status boolean not null default true,
  add column if not exists sync_images boolean not null default false;

create unique index if not exists products_zq_product_unique
  on public.products(zq_product_id) where zq_product_id is not null;
create index if not exists products_visibility_idx on public.products(visibility,status);
create index if not exists products_tags_gin on public.products using gin(tags);

alter table public.product_variants
  add column if not exists barcode text,
  add column if not exists supplier_title text,
  add column if not exists supplier_attributes jsonb not null default '{}'::jsonb,
  add column if not exists image_url text,
  add column if not exists manage_stock boolean not null default true,
  add column if not exists allow_backorder boolean not null default false,
  add column if not exists low_stock_threshold integer,
  add column if not exists dimensions jsonb not null default '{}'::jsonb,
  add column if not exists zq_last_synced_at timestamptz;

-- Reusable taxonomies. The legacy products.category/collection fields remain for
-- backwards-compatible storefront routes while these power the richer admin.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  parent_id uuid references public.categories(id) on delete set null,
  seo_title text,
  seo_description text,
  image_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  seo_title text,
  seo_description text,
  image_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  is_primary boolean not null default false,
  primary key(product_id, category_id)
);

create table if not exists public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key(product_id, collection_id)
);

create table if not exists public.product_tags (
  product_id uuid not null references public.products(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key(product_id, tag_id)
);

-- WooCommerce-like reusable attributes and terms.
create table if not exists public.attributes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text not null default 'select' check(type in ('select','text','colour')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references public.attributes(id) on delete cascade,
  value text not null,
  slug text not null,
  colour_hex text,
  sort_order integer not null default 0,
  unique(attribute_id, slug)
);

create table if not exists public.product_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_id uuid references public.attributes(id) on delete set null,
  name text not null,
  values jsonb not null default '[]'::jsonb,
  visible boolean not null default true,
  used_for_variations boolean not null default false,
  sort_order integer not null default 0
);

-- Supplier audit/sync history: raw ZQ payloads are retained so nothing is lost.
create table if not exists public.zq_sync_log (
  id bigserial primary key,
  product_id uuid references public.products(id) on delete cascade,
  zq_product_id bigint,
  sync_type text not null,
  fields text[] not null default '{}',
  success boolean not null default true,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists zq_sync_log_product_idx on public.zq_sync_log(product_id,created_at desc);

-- Linked/cross-sell products.
create table if not exists public.product_links (
  product_id uuid not null references public.products(id) on delete cascade,
  linked_product_id uuid not null references public.products(id) on delete cascade,
  link_type text not null check(link_type in ('related','cross_sell','upsell')),
  sort_order integer not null default 0,
  primary key(product_id,linked_product_id,link_type),
  check(product_id <> linked_product_id)
);

-- Touch triggers.
do $$
declare t text;
begin
  foreach t in array array['categories','collections']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- Seed primary merchandising taxonomies.
insert into public.categories(name,slug,sort_order) values
 ('Rings','rings',10),('Necklaces','necklaces',20),('Earrings','earrings',30),('Bracelets','bracelets',40)
on conflict(slug) do nothing;

insert into public.collections(name,slug,sort_order) values
 ('The Ivy Edit','the-ivy-edit',10),('New Arrivals','new-arrivals',20),('Most Loved','most-loved',30)
on conflict(slug) do nothing;

insert into public.attributes(name,slug,type,sort_order) values
 ('Ring Size','ring-size','select',10),('Metal','metal','select',20),('Stone','stone','select',30),('Colour','colour','colour',40),('Finish','finish','select',50)
on conflict(slug) do nothing;

-- RLS
-- Policies are dropped first so this migration is safe to re-run from the setup script.
drop policy if exists "public categories" on public.categories;
drop policy if exists "public collections" on public.collections;
drop policy if exists "public tags" on public.tags;
drop policy if exists "public product categories" on public.product_categories;
drop policy if exists "public product collections" on public.product_collections;
drop policy if exists "public product tags" on public.product_tags;
drop policy if exists "public attributes" on public.attributes;
drop policy if exists "public attribute values" on public.attribute_values;
drop policy if exists "public product attributes" on public.product_attributes;
drop policy if exists "public product links" on public.product_links;
drop policy if exists "admin categories" on public.categories;
drop policy if exists "admin collections" on public.collections;
drop policy if exists "admin tags" on public.tags;
drop policy if exists "admin product categories" on public.product_categories;
drop policy if exists "admin product collections" on public.product_collections;
drop policy if exists "admin product tags" on public.product_tags;
drop policy if exists "admin attributes" on public.attributes;
drop policy if exists "admin attribute values" on public.attribute_values;
drop policy if exists "admin product attributes" on public.product_attributes;
drop policy if exists "admin zq sync log" on public.zq_sync_log;
drop policy if exists "admin product links" on public.product_links;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.tags enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_collections enable row level security;
alter table public.product_tags enable row level security;
alter table public.attributes enable row level security;
alter table public.attribute_values enable row level security;
alter table public.product_attributes enable row level security;
alter table public.zq_sync_log enable row level security;
alter table public.product_links enable row level security;

create policy "public categories" on public.categories for select using(active or public.is_admin());
create policy "public collections" on public.collections for select using(active or public.is_admin());
create policy "public tags" on public.tags for select using(true);
create policy "public product categories" on public.product_categories for select using(true);
create policy "public product collections" on public.product_collections for select using(true);
create policy "public product tags" on public.product_tags for select using(true);
create policy "public attributes" on public.attributes for select using(true);
create policy "public attribute values" on public.attribute_values for select using(true);
create policy "public product attributes" on public.product_attributes for select using(true);
create policy "public product links" on public.product_links for select using(true);

create policy "admin categories" on public.categories for all using(public.is_admin()) with check(public.is_admin());
create policy "admin collections" on public.collections for all using(public.is_admin()) with check(public.is_admin());
create policy "admin tags" on public.tags for all using(public.is_admin()) with check(public.is_admin());
create policy "admin product categories" on public.product_categories for all using(public.is_admin()) with check(public.is_admin());
create policy "admin product collections" on public.product_collections for all using(public.is_admin()) with check(public.is_admin());
create policy "admin product tags" on public.product_tags for all using(public.is_admin()) with check(public.is_admin());
create policy "admin attributes" on public.attributes for all using(public.is_admin()) with check(public.is_admin());
create policy "admin attribute values" on public.attribute_values for all using(public.is_admin()) with check(public.is_admin());
create policy "admin product attributes" on public.product_attributes for all using(public.is_admin()) with check(public.is_admin());
create policy "admin zq sync log" on public.zq_sync_log for all using(public.is_admin()) with check(public.is_admin());
create policy "admin product links" on public.product_links for all using(public.is_admin()) with check(public.is_admin());
