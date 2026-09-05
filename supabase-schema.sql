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
  fecha timestamptz not null default now(),
  vendedor text,
  total numeric not null default 0,
  items jsonb not null default '[]'
);

create table if not exists usuarios (
  usuario text primary key,
  clave text not null,
  nombre text not null,
  rol text not null default 'vendedor'
);

-- Nota de seguridad: estas tablas quedan SIN Row Level Security (RLS),
-- es decir, accesibles con la llave pública (anon key) sin restricciones.
-- Es la forma más simple de conectar la app sin un backend propio,
-- pero significa que cualquiera con esa llave podría leer o escribir
-- directamente en la base de datos. Suficiente para un negocio pequeño
-- con datos no críticos; si más adelante quieres reforzarlo, se puede
-- migrar a Supabase Auth + políticas RLS.
