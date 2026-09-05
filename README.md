# Minimarket

App de facturación e inventario para minimarket: stock, precio de ingreso, precio de venta, búsqueda de productos y facturación con historial. Incluye un modo administrador con PIN para restringir quién puede editar el inventario y anular ventas.

## Cómo abrirlo en VS Code

1. Descomprime esta carpeta y ábrela en VS Code (`Archivo > Abrir carpeta...`).
2. Abre una terminal integrada (`Terminal > Nueva terminal`) y ejecuta:

   ```
   npm install
   ```

   Esto instala React, Vite y los íconos (`lucide-react`) que usa la app. Solo se hace una vez.

3. Para correr la app en modo desarrollo:

   ```
   npm run dev
   ```

   Vite te mostrará un enlace como `http://localhost:5173` — ábrelo en tu navegador.

4. Cuando quieras generar la versión final para publicar en un hosting (Vercel, Netlify, etc.):

   ```
   npm run build
   ```

   Esto genera una carpeta `dist/` lista para subir a cualquier servicio de hosting estático.

## Importante: cómo se guardan los datos

Esta versión guarda el inventario y las ventas en el `localStorage` del navegador, es decir: **los datos quedan guardados solo en el navegador/computador donde la uses**, no se comparten automáticamente entre distintos dispositivos o personas.

- Si la vas a usar solo tú, desde un mismo computador, esto es suficiente.
- Si necesitas que tú y un empleado vean y editen el mismo inventario desde equipos distintos (como en el punto de venta real), vas a necesitar una base de datos compartida (por ejemplo Supabase, Firebase, o un pequeño backend propio). Ese es el siguiente paso natural si decides llevar esto a producción — avísame cuando quieras montarlo y lo armamos juntos.

## Usuarios y roles

La primera vez que abras la app te va a pedir crear la cuenta de **administrador** (tu nombre, usuario y contraseña). Con esa cuenta entras a la pestaña "Usuarios" y creas ahí los usuarios de tus 3 o 4 vendedores (nombre, usuario, contraseña, rol "Vendedor").

- **Administrador**: ve y edita todo — inventario, usuarios, puede anular ventas y exportar a Excel.
- **Vendedor**: puede buscar productos, ver precios y stock, y facturar. No puede editar el inventario ni gestionar usuarios.

Importante: las contraseñas se guardan en el navegador sin cifrado fuerte (no es un sistema con nivel de seguridad bancario). Para un negocio con empleados de confianza es suficiente, pero no la uses para guardar información realmente sensible.

## Exportar a Excel

Con la cuenta de administrador, el botón "Excel" en la esquina superior derecha descarga un archivo `.xlsx` con dos hojas: "Inventario" (todos los productos con stock y precios) y "Ventas" (el detalle de cada venta, con fecha y vendedor). Se descarga directo al navegador, no requiere conexión a internet ni backend.

Después de agregar esta función necesitas correr una vez más:
```
npm install
```
para instalar la librería `xlsx` que usa la exportación.
