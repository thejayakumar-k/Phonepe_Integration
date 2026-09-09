-- Add delivery address to item orders for live map tracking.
-- The cart address picker saves {"address","lat","lng"} so the customer can
-- track the delivery bike's OSRM route to their real destination.
alter table public.item_orders
  add column if not exists delivery_address jsonb;

comment on column public.item_orders.delivery_address is
  '{"address","lat","lng"} saved from the cart address picker so tracking can show a real route to the customer.';