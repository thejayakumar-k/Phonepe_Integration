-- OORUNII Supabase Schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run

-- ── Orders ─────────────────────────────────────────────────────────
create table if not exists public.orders (
  order_id text primary key,
  vendor_id text,
  vendor_name text,
  customer_id text,
  customer_name text,
  amount numeric not null default 0,
  currency text not null default 'INR',
  description text not null default '',
  created_at bigint not null,
  expires_at bigint not null,
  payment_status text not null default 'PENDING',
  payment_method text,
  payment_submitted_at bigint,
  payment_verified_at bigint,
  transaction_id text,
  order_placed_at bigint,
  cod_placed_at bigint
);

create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_vendor_idx on public.orders (vendor_id);
create index if not exists orders_status_idx on public.orders (payment_status);

-- ── Item Orders (product-level orders, items stored as jsonb) ──────
create table if not exists public.item_orders (
  id text primary key,
  customer_id text not null,
  customer_name text,
  vendor_id text,
  vendor_name text,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  status text not null default 'PENDING',
  payment_method text,
  payment_order_id text,
  created_at bigint not null
);

create index if not exists item_orders_customer_idx on public.item_orders (customer_id);
create index if not exists item_orders_vendor_idx on public.item_orders (vendor_id);

-- ── Item order ↔ payment order links ───────────────────────────────
create table if not exists public.item_order_links (
  payment_order_id text primary key,
  item_order_id text not null
);

-- ── Refunds ────────────────────────────────────────────────────────
create table if not exists public.refunds (
  id text primary key,
  order_id text not null,
  amount numeric not null default 0,
  reason text not null default '',
  status text not null default 'INITIATED',
  initiated_at bigint not null,
  completed_at bigint,
  payu_refund_id text,
  customer_name text,
  vendor_id text
);

create index if not exists refunds_order_idx on public.refunds (order_id);

-- ── Bank accounts (customer bank mapping) ──────────────────────────
create table if not exists public.bank_accounts (
  id text primary key,
  customer_id text not null,
  bank_name text not null,
  account_holder_name text not null,
  account_number text not null,
  ifsc_code text not null,
  masked_account_number text not null,
  is_preferred boolean not null default false,
  created_at bigint not null
);

create index if not exists bank_accounts_customer_idx on public.bank_accounts (customer_id);

-- ── Wallet margins ─────────────────────────────────────────────────
create table if not exists public.margins (
  customer_id text primary key,
  balance numeric not null default 0
);

-- ── Managed UPI IDs (first row = active) ───────────────────────────
create table if not exists public.upi_ids (
  id text primary key,
  position integer not null default 0
);

-- ── Store settings (first row = active) ────────────────────────────
-- The chatbot and the app read store identity from here, so changing
-- the store name / vendor id / support contact needs no code changes.
create table if not exists public.store_settings (
  id serial primary key,
  vendor_id text not null default 'VENDOR001',
  store_name text not null default 'OORUNII Store',
  currency text not null default 'INR',
  support_contact text not null default ''
);

insert into public.store_settings (vendor_id, store_name, currency, support_contact)
select 'VENDOR001', 'OORUNII Store', 'INR', ''
where not exists (select 1 from public.store_settings);

-- ── Knowledge base (chatbot answers these automatically) ───────────
-- Add any question + answer here and the bot will know it on the next
-- message — no code changes. `keywords` holds extra words the bot can
-- use to match the question (English/Tamil/Thanglish).
create table if not exists public.faqs (
  id serial primary key,
  question text not null,
  answer text not null,
  keywords text[] not null default '{}',
  sort_order integer not null default 0
);

-- ── Products (chatbot + cart catalog — fully automatic) ────────────
-- The chatbot and the cart page read this table on every load, so a
-- product added here is understood immediately (name, price, unit,
-- image, and any English / Tamil / Thanglish spellings in `aliases`).
-- No code changes or redeploys needed.
create table if not exists public.products (
  id serial primary key,
  name text not null unique,
  price numeric not null default 0,
  unit text not null default '',
  image text not null default '',
  aliases text[] not null default '{}'
);

insert into public.products (name, price, unit, image, aliases)
values
  ('Aquafina', 20.0, 'PACK (LITER)', '💧',
   array['aqua', 'அக்வாஃபைனா', 'அக்வாபைனா', 'அக்வாஃபினா', 'thanneer', 'thannir', 'tanneer', 'aquafina water']),
  ('Bisleri', 40.0, 'CAN (LITER)', '🧊',
   array['bislery', 'bisleri water', 'பிஸ்லரி', 'பிஸ்லேரி', 'pisleri', 'besleri', 'bisleri']),
  ('Kinley', 25.0, 'PACK (LITER)', '💧',
   array['kinly', 'kinli', 'கின்லி', 'கிண்லி', 'kinley water'])
on conflict (name) do nothing;

-- ── Row Level Security ─────────────────────────────────────────────
-- NOTE: These are PERMISSIVE policies so the frontend (publishable key)
-- can read/write. For production, replace with auth-based policies
-- (e.g. `auth.uid()::text = customer_id`) and enable Supabase Auth.

alter table public.orders enable row level security;
alter table public.item_orders enable row level security;
alter table public.item_order_links enable row level security;
alter table public.refunds enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.margins enable row level security;
alter table public.upi_ids enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.faqs enable row level security;

create policy "anon_all_orders" on public.orders for all using (true) with check (true);
create policy "anon_all_item_orders" on public.item_orders for all using (true) with check (true);
create policy "anon_all_item_order_links" on public.item_order_links for all using (true) with check (true);
create policy "anon_all_refunds" on public.refunds for all using (true) with check (true);
create policy "anon_all_bank_accounts" on public.bank_accounts for all using (true) with check (true);
create policy "anon_all_margins" on public.margins for all using (true) with check (true);
create policy "anon_all_upi_ids" on public.upi_ids for all using (true) with check (true);
create policy "anon_all_products" on public.products for all using (true) with check (true);
create policy "anon_all_store_settings" on public.store_settings for all using (true) with check (true);
create policy "anon_all_faqs" on public.faqs for all using (true) with check (true);