# Minimarket

App de facturación e inventario para minimarket: stock, precio de ingreso, precio de venta, búsqueda/escaneo de productos, facturación con número de ticket, pago en efectivo (con cálculo de cambio) o transferencia, historial con totales del día, impresión de recibos y exportación a Excel. Los datos se guardan en una base de datos en la nube (Supabase), para que todos los dispositivos vean la misma información en tiempo real.

## Cómo correrlo en VS Code

1. Abre esta carpeta en VS Code (`Archivo > Abrir carpeta...`).
2. Terminal integrada (`Terminal > Nueva terminal`):
   ```
   npm install
   npm run dev
   ```
3. Sigue las instrucciones de conexión a Supabase más abajo antes de usarla en serio.

## Conectar con Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: pega y ejecuta todo el contenido de `supabase-schema.sql` (crea las tablas, permisos y políticas necesarias).
3. **Project Settings → API Keys** (pestaña "Publishable and secret API keys"): copia el **Project URL** y la **Publishable key**.
4. Crea un archivo `.env` en la raíz del proyecto (puedes copiar `.env.example`) y pega ahí esos dos valores.
5. Reinicia `npm run dev`.

### Si ya tenías el proyecto de Supabase de antes de esta versión

Ejecuta también, una sola vez, el archivo `migracion-pagos.sql` en el SQL Editor — agrega las columnas de número de venta, método de pago y cambio a la tabla `ventas` que ya tenías creada.

## Usuarios y roles

Primer uso: crea la cuenta de **administrador** (nombre, usuario, contraseña). Desde la pestaña "Usuarios" el administrador da de alta a los vendedores (nombre, usuario, contraseña, rol "Vendedor").

- **Administrador**: edita inventario, gestiona usuarios, anula ventas, exporta a Excel.
- **Vendedor**: busca productos, ve precios/stock, factura. No edita inventario ni usuarios.

Nota de seguridad: las contraseñas se guardan sin cifrado fuerte y las tablas quedan con políticas abiertas (sin autenticación fina) — suficiente para un negocio con empleados de confianza, no para datos críticos.

## Facturar

- Busca por nombre o código. Si escribes/escaneas un código exacto y solo hay una coincidencia, presiona **Enter** para agregarlo directo al ticket — así funciona con una **lectora de código de barras USB** normal (la mayoría son "teclado emulado": escriben el código y presionan Enter solas, sin necesitar ningún driver ni configuración extra).
- Al hacer clic manual en un resultado, te pregunta la cantidad a agregar.
- Al cobrar, elige **Efectivo** (te pide cuánto paga el cliente y calcula el cambio) o **Transferencia**.
- Cada venta queda con un número de ticket consecutivo (#1, #2, #3...).

## Mesas

Además de "Facturar" (venta rápida de mostrador), la pestaña "Mesas" permite abrir una cuenta por mesa: se le van agregando productos poco a poco (igual que en Facturar, con búsqueda/escaneo), queda guardada y visible para todos los dispositivos aunque cierres la pestaña, y se cobra cuando el cliente termina — con el mismo flujo de efectivo/transferencia y cambio. El administrador crea, renombra o elimina las mesas desde esa misma pestaña.

### Si ya tenías el proyecto de Supabase de antes de esta versión

Ejecuta también, una sola vez, el archivo `migracion-mesas.sql` en el SQL Editor.

## Historial

Muestra, arriba de todo, el total de ventas de hoy, el dinero total vendido hoy y las unidades vendidas hoy. Cada venta se puede expandir para ver el detalle, imprimir, o (solo administrador) anular — anular devuelve el stock al inventario.

## Imprimir recibos

El botón de impresora (en el ticket recién cobrado o en cualquier venta del historial) abre el diálogo de impresión normal del navegador con un recibo angosto tipo ticket. Funciona con cualquier impresora que tengas instalada en el sistema — incluidas la mayoría de impresoras térmicas de punto de venta (58mm/80mm), siempre que tengan su driver instalado en Windows como una impresora normal.

## Exportar a Excel

Con la cuenta de administrador, el botón "Excel" descarga un `.xlsx` con dos hojas: "Inventario" y "Ventas" (incluye número de venta, vendedor, método de pago, recibido y cambio).

## Publicarla (Netlify)

1. Sube el proyecto a GitHub (`git add .`, `git commit`, `git push`).
2. En Netlify: importa el repositorio, build command `npm run build`, publish directory `dist`.
3. Antes de desplegar, agrega las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (los mismos valores de tu `.env`).
4. Cada vez que hagas `git push`, Netlify reconstruye el sitio publicado automáticamente.

## Importar productos desde Excel

Si tienes tu inventario en un Excel con columnas Código, Producto, Categoría, Stock, Precio de ingreso, Precio de venta, se puede generar un script SQL de importación masiva — pídeselo a Claude adjuntando el archivo.
