-- Customers (shared by customer login, vendor tools and web-login pricing)
-- `id` is the login id (e.g. CUST001). Address/phone/status/location_type
-- drive the login flow and the web-login pricing configuration.

create table if not exists public.customers (
  id text primary key,
  name text not null,
  address text not null default '',
  phone text not null default '',
  status text not null default 'Active',          -- Active | Inactive
  location_type text not null default 'Residential', -- Residential | Commercial | Other
  created_at bigint not null default extract(epoch from now())::bigint
);

alter table public.customers enable row level security;

-- Permissive policy so the frontend (publishable key) can read/write.
-- For production, replace with auth-based policies
-- (e.g. auth.uid()::text = id) and enable Supabase Auth.
create policy "anon_all_customers" on public.customers
  for all using (true) with check (true);

-- Seed the two existing demo accounts so the login works immediately.
insert into public.customers (id, name, address, phone, status, location_type)
values
  ('CUST001', 'Ravi Kumar', '14, Pillayar Koil St, Maduravoyal, Chennai – 600095', '+91 98765 43210', 'Active', 'Residential'),
  ('CUST002', 'Priya Sharma', 'Anna Nagar, Chennai – 600040', '+91 98765 11111', 'Active', 'Residential')
on conflict (id) do nothing;

-- Realtime: broadcast INSERT/UPDATE/DELETE on this table to all clients.
alter publication supabase_realtime add table public.customers;
