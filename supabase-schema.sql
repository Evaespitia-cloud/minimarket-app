-- Ejecuta este script completo en Supabase: panel del proyecto > SQL Editor > New query > pegar > Run

create table if not exists productos (
  id text primary key,
  codigo text,
  nombre text not null,
  categoria text,
  stock integer not null default 0,
  precio_ingreso numeric not null default 0,
  precio_venta numeric not null default 0
);

create table if not exists ventas (
  id text primary key,
  numero bigserial,
  fecha timestamptz not null default now(),
  vendedor text,
  total numeric not null default 0,
  metodo_pago text default 'efectivo',
  monto_recibido numeric,
  cambio numeric,
  items jsonb not null default '[]'
);

create table if not exists usuarios (
  usuario text primary key,
  clave text not null,
  nombre text not null,
  rol text not null default 'vendedor'
);

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

-- Nota de seguridad: estas tablas quedan SIN Row Level Security (RLS),
-- es decir, accesibles con la llave pública (anon key) sin restricciones.
-- Es la forma más simple de conectar la app sin un backend propio,
-- pero significa que cualquiera con esa llave podría leer o escribir
-- directamente en la base de datos. Suficiente para un negocio pequeño
-- con datos no críticos; si más adelante quieres reforzarlo, se puede
-- migrar a Supabase Auth + políticas RLS.

-- Como las tablas se crean por SQL directo (no desde el Table Editor),
-- hay que otorgar permisos manualmente a los roles anon/authenticated,
-- o las peticiones desde la app fallarán con error 401.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;

-- El sistema nuevo de llaves de Supabase (Publishable/Secret) exige
-- Row Level Security activo con al menos una política, o bloquea
-- TODAS las operaciones con el error "violates row-level security policy".
-- Estas políticas permiten todo (mismo nivel de acceso simple que
-- veníamos usando, ahora explícito):
alter table productos enable row level security;
alter table ventas enable row level security;
alter table usuarios enable row level security;

create policy "acceso total productos" on productos for all using (true) with check (true);
create policy "acceso total ventas" on ventas for all using (true) with check (true);
create policy "acceso total usuarios" on usuarios for all using (true) with check (true);

alter table mesas enable row level security;
alter table pedidos_mesa enable row level security;
create policy "acceso total mesas" on mesas for all using (true) with check (true);
create policy "acceso total pedidos_mesa" on pedidos_mesa for all using (true) with check (true);

