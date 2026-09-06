-- Ejecuta esto UNA VEZ en el SQL Editor de Supabase para agregar
-- la función de facturar por mesas.

create table if not exists mesas (
  id text primary key,
  nombre text not null
);

create table if not exists pedidos_mesa (
  id text primary key,
  mesa_id text not null references mesas(id) on delete cascade,
  items jsonb not null default '[]',
  abierta_en timestamptz not null default now(),
  vendedor text
);

alter table ventas add column if not exists mesa text;

grant usage on schema public to anon, authenticated;
grant all on mesas, pedidos_mesa to anon, authenticated;

alter table mesas enable row level security;
alter table pedidos_mesa enable row level security;

create policy "acceso total mesas" on mesas for all using (true) with check (true);
create policy "acceso total pedidos_mesa" on pedidos_mesa for all using (true) with check (true);
