-- Pricing configuration (from the Web Login pricing page) + address floor
-- The customer address form reads the floor list from here, so a floor
-- added in web login appears instantly in the address form.

create table if not exists public.pricing_config (
  id integer primary key default 1 check (id = 1),
  config jsonb not null,                     -- full PricingConfig shape
  updated_at bigint not null default extract(epoch from now())::bigint
);

insert into public.pricing_config (id, config)
values (1, '{
  "houseApartment": {
    "enabled": true,
    "useFloorWise": true,
    "floorPricing": {
      "groundFloor": 20,
      "floor1": 25,
      "floor2": 30,
      "floor3": 35,
      "moreThan3Mode": "custom",
      "customPrice": 40
    }
  },
  "commercial": { "enabled": true, "useCustomerSpecific": true, "price": 30 },
  "other": { "enabled": true, "useDefaultPrice": false, "defaultPrice": 25 }
}'::jsonb)
on conflict (id) do nothing;

alter table public.pricing_config enable row level security;

-- Permissive policy so the frontend (publishable key) can read/write.
-- For production, replace with auth-based policies and enable Supabase Auth.
create policy "anon_all_pricing_config" on public.pricing_config
  for all using (true) with check (true);

alter publication supabase_realtime add table public.pricing_config;

-- ── Floor on saved customer addresses ──────────────────────────────
alter table public.customer_addresses
  add column if not exists floor text not null default '';

comment on column public.pricing_config.config is
  'Web-login pricing: houseApartment.floorPricing drives the floor list in the customer address form.';
