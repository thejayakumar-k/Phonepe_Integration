-- Customer saved addresses (for the cart address picker)

create table if not exists public.customer_addresses (
  id text primary key,
  customer_id text not null,
  address text not null,                 -- display string, e.g. "14, Pillayar Koil St, ..."
  house_no text not null default '',
  street text not null default '',
  apartment text not null default '',    -- apartment name / searchable field
  area text not null default '',
  city text not null default '',
  pincode text not null default '',
  landmark text not null default '',
  address_type text not null default 'Apt', -- Apt | House | Commercial | Others
  lat numeric,
  lng numeric,
  created_at bigint not null default extract(epoch from now())::bigint
);

create index if not exists customer_addresses_customer_idx
  on public.customer_addresses (customer_id);

alter table public.customer_addresses enable row level security;

-- Permissive policy so the frontend (publishable key) can read/write.
-- For production, replace with auth-based policies
-- (e.g. auth.uid()::text = customer_id) and enable Supabase Auth.
create policy "anon_all_customer_addresses" on public.customer_addresses
  for all using (true) with check (true);

comment on table public.customer_addresses is
  'Saved delivery addresses chosen from the cart address picker.';
