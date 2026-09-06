-- Ejecuta esto UNA VEZ en el SQL Editor de Supabase para agregar
-- número de venta, método de pago y cálculo de cambio a la tabla ventas.

alter table ventas add column if not exists numero bigserial;
alter table ventas add column if not exists metodo_pago text default 'efectivo';
alter table ventas add column if not exists monto_recibido numeric;
alter table ventas add column if not exists cambio numeric;
