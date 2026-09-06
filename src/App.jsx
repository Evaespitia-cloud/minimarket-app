import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import {
  Search, Plus, Minus, Trash2, Store, Package, ShoppingCart,
  History, X, AlertTriangle, Pencil, Check, Loader2,
  Users, UserPlus, LogOut, Download, RefreshCw, Printer, Banknote, Landmark
} from "lucide-react";

const UMBRAL_STOCK_BAJO = 5;

function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatoMoneda(valor) {
  const n = Number(valor) || 0;
  return "$" + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

function formVacio() {
  return { codigo: "", nombre: "", categoria: "", stock: "", precioIngreso: "", precioVenta: "" };
}

function formUsuarioVacio() {
  return { nombre: "", usuario: "", clave: "", rol: "vendedor" };
}

function mapProductoDesdeDB(p) {
  return {
    id: p.id, codigo: p.codigo || "", nombre: p.nombre, categoria: p.categoria || "",
    stock: Number(p.stock) || 0, precioIngreso: Number(p.precio_ingreso) || 0, precioVenta: Number(p.precio_venta) || 0,
  };
}

function mapProductoHaciaDB(p) {
  return {
    id: p.id, codigo: p.codigo, nombre: p.nombre, categoria: p.categoria,
    stock: p.stock, precio_ingreso: p.precioIngreso, precio_venta: p.precioVenta,
  };
}

function mapVentaDesdeDB(v) {
  return {
    id: v.id, numero: v.numero, fecha: v.fecha, vendedor: v.vendedor, total: Number(v.total) || 0,
    metodoPago: v.metodo_pago || "efectivo",
    montoRecibido: v.monto_recibido != null ? Number(v.monto_recibido) : null,
    cambio: v.cambio != null ? Number(v.cambio) : null,
    items: v.items || [],
  };
}

export default function MinimarketApp() {
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState("");
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [sesion, setSesion] = useState(null);
  const [vista, setVista] = useState("facturar");

  const [loginUsuario, setLoginUsuario] = useState("");
  const [loginClave, setLoginClave] = useState("");
  const [loginError, setLoginError] = useState("");
  const [setupNombre, setSetupNombre] = useState("");
  const [setupUsuario, setSetupUsuario] = useState("");
  const [setupClave, setSetupClave] = useState("");
  const [setupClave2, setSetupClave2] = useState("");
  const [setupError, setSetupError] = useState("");

  const [busquedaInventario, setBusquedaInventario] = useState("");
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio());

  const [busquedaVenta, setBusquedaVenta] = useState("");
  const [ticket, setTicket] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [ventaParaImprimir, setVentaParaImprimir] = useState(null);

  const [formUsuarioAbierto, setFormUsuarioAbierto] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState(null);
  const [formUsuario, setFormUsuario] = useState(formUsuarioVacio());

  const isAdmin = sesion?.rol === "admin";

  async function recargarProductos() {
    const { data, error: e } = await supabase.from("productos").select("*").order("nombre");
    if (e) { setError("No se pudo cargar el inventario. Revisa tu conexión."); return; }
    setProductos((data || []).map(mapProductoDesdeDB));
  }

  async function recargarVentas() {
    const { data, error: e } = await supabase.from("ventas").select("*").order("fecha", { ascending: false });
    if (e) { setError("No se pudo cargar el historial de ventas."); return; }
    setVentas((data || []).map(mapVentaDesdeDB));
  }

  async function recargarUsuarios() {
    const { data, error: e } = await supabase.from("usuarios").select("*");
    if (e) { setError("No se pudo cargar los usuarios."); return; }
    setUsuarios(data || []);
  }

  async function recargarTodo(mostrarIndicador) {
    if (mostrarIndicador) setSincronizando(true);
    await Promise.all([recargarProductos(), recargarVentas(), recargarUsuarios()]);
    if (mostrarIndicador) setSincronizando(false);
  }

  useEffect(() => {
    recargarTodo(false).finally(() => setCargando(false));
  }, []);

  // Refresca al cambiar de pestaña, para traer cambios hechos desde otro dispositivo
  useEffect(() => {
    if (!cargando) recargarTodo(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 3200);
    return () => clearTimeout(t);
  }, [mensaje]);

  // ---- Autenticación ----
  async function crearPrimerAdmin(e) {
    e.preventDefault();
    if (!setupNombre.trim() || !setupUsuario.trim() || setupClave.length < 4) {
      setSetupError("Completa todos los campos. La contraseña debe tener al menos 4 caracteres.");
      return;
    }
    if (setupClave !== setupClave2) {
      setSetupError("Las contraseñas no coinciden.");
      return;
    }
    const admin = { usuario: setupUsuario.trim(), clave: setupClave, nombre: setupNombre.trim(), rol: "admin" };
    const { error: err } = await supabase.from("usuarios").insert(admin);
    if (err) {
      setSetupError("No se pudo crear la cuenta. Revisa tu conexión a la base de datos.");
      return;
    }
    setUsuarios([admin]);
    setSesion({ usuario: admin.usuario, nombre: admin.nombre, rol: "admin" });
  }

  async function iniciarSesion(e) {
    e.preventDefault();
    const { data, error: err } = await supabase
      .from("usuarios")
      .select("*")
      .ilike("usuario", loginUsuario.trim())
      .maybeSingle();
    if (err || !data || data.clave !== loginClave) {
      setLoginError("Usuario o contraseña incorrectos.");
      return;
    }
    setSesion({ usuario: data.usuario, nombre: data.nombre, rol: data.rol });
    setLoginUsuario("");
    setLoginClave("");
    setLoginError("");
  }

  function cerrarSesion() {
    setSesion(null);
    setTicket([]);
    setVista("facturar");
  }

  // ---- Usuarios (admin) ----
  function abrirNuevoUsuario() {
    setFormUsuario(formUsuarioVacio());
    setEditandoUsuario(null);
    setFormUsuarioAbierto(true);
  }

  function abrirEdicionUsuario(u) {
    setFormUsuario({ nombre: u.nombre, usuario: u.usuario, clave: "", rol: u.rol });
    setEditandoUsuario(u.usuario);
    setFormUsuarioAbierto(true);
  }

  function cerrarFormUsuario() {
    setFormUsuarioAbierto(false);
    setEditandoUsuario(null);
    setFormUsuario(formUsuarioVacio());
  }

  async function guardarFormUsuario(e) {
    e.preventDefault();
    const nombre = formUsuario.nombre.trim();
    const usuarioNombre = formUsuario.usuario.trim();
    if (!nombre || !usuarioNombre) {
      setMensaje({ tipo: "error", texto: "Completa nombre y usuario." });
      return;
    }
    const existente = editandoUsuario ? usuarios.find((u) => u.usuario === editandoUsuario) : null;
    const clave = formUsuario.clave.trim() ? formUsuario.clave.trim() : existente?.clave;
    if (!clave || clave.length < 4) {
      setMensaje({ tipo: "error", texto: "La contraseña debe tener al menos 4 caracteres." });
      return;
    }
    const duplicado = usuarios.find(
      (u) => u.usuario.toLowerCase() === usuarioNombre.toLowerCase() && u.usuario !== editandoUsuario
    );
    if (duplicado) {
      setMensaje({ tipo: "error", texto: "Ese nombre de usuario ya existe." });
      return;
    }
    const nuevo = { usuario: usuarioNombre, clave, nombre, rol: formUsuario.rol };
    const { error: err } = await supabase.from("usuarios").upsert(nuevo);
    if (err) {
      setMensaje({ tipo: "error", texto: "No se pudo guardar el usuario." });
      return;
    }
    setUsuarios((prev) =>
      editandoUsuario ? prev.map((u) => (u.usuario === editandoUsuario ? nuevo : u)) : [...prev, nuevo]
    );
    cerrarFormUsuario();
  }

  async function eliminarUsuario(usuario) {
    if (usuario === sesion.usuario) {
      setMensaje({ tipo: "error", texto: "No puedes eliminar tu propia cuenta mientras estás conectado." });
      return;
    }
    const objetivo = usuarios.find((u) => u.usuario === usuario);
    const admins = usuarios.filter((u) => u.rol === "admin");
    if (objetivo?.rol === "admin" && admins.length <= 1) {
      setMensaje({ tipo: "error", texto: "Debe existir al menos un administrador." });
      return;
    }
    if (!confirm(`¿Eliminar el usuario "${usuario}"?`)) return;
    const { error: err } = await supabase.from("usuarios").delete().eq("usuario", usuario);
    if (err) {
      setMensaje({ tipo: "error", texto: "No se pudo eliminar el usuario." });
      return;
    }
    setUsuarios((prev) => prev.filter((u) => u.usuario !== usuario));
  }

  // ---- Inventario ----
  function abrirNuevo() {
    setForm(formVacio());
    setEditandoId(null);
    setFormAbierto(true);
  }

  function abrirEdicion(p) {
    setForm({
      codigo: p.codigo, nombre: p.nombre, categoria: p.categoria || "",
      stock: String(p.stock), precioIngreso: String(p.precioIngreso), precioVenta: String(p.precioVenta),
    });
    setEditandoId(p.id);
    setFormAbierto(true);
  }

  function cerrarForm() {
    setFormAbierto(false);
    setEditandoId(null);
    setForm(formVacio());
  }

  async function guardarForm(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    const producto = {
      id: editandoId || nuevoId(),
      codigo: form.codigo.trim(), nombre: form.nombre.trim(), categoria: form.categoria.trim(),
      stock: Number(form.stock) || 0, precioIngreso: Number(form.precioIngreso) || 0, precioVenta: Number(form.precioVenta) || 0,
    };
    const { error: err } = await supabase.from("productos").upsert(mapProductoHaciaDB(producto));
    if (err) {
      setMensaje({ tipo: "error", texto: "No se pudo guardar el producto." });
      return;
    }
    setProductos((prev) =>
      editandoId ? prev.map((p) => (p.id === editandoId ? producto : p)) : [...prev, producto]
    );
    cerrarForm();
  }

  async function eliminarProducto(id) {
    if (!confirm("¿Eliminar este producto del inventario?")) return;
    const { error: err } = await supabase.from("productos").delete().eq("id", id);
    if (err) {
      setMensaje({ tipo: "error", texto: "No se pudo eliminar el producto." });
      return;
    }
    setProductos((prev) => prev.filter((p) => p.id !== id));
  }

  async function ajustarStock(id, delta) {
    const producto = productos.find((p) => p.id === id);
    if (!producto) return;
    const nuevoStock = Math.max(0, producto.stock + delta);
    const { error: err } = await supabase.from("productos").update({ stock: nuevoStock }).eq("id", id);
    if (err) {
      setMensaje({ tipo: "error", texto: "No se pudo actualizar el stock." });
      return;
    }
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, stock: nuevoStock } : p)));
  }

  async function borrarInventario() {
    if (!confirm("Esto borrará todos los productos del inventario. ¿Continuar?")) return;
    const { error: err } = await supabase.from("productos").delete().not("id", "is", null);
    if (err) {
      setMensaje({ tipo: "error", texto: "No se pudo borrar el inventario." });
      return;
    }
    setProductos([]);
  }

  const productosFiltrados = productos.filter((p) => {
    const q = busquedaInventario.trim().toLowerCase();
    if (!q) return true;
    return p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
  });

  // ---- Facturación ----
  const resultadosVenta = busquedaVenta.trim()
    ? productos.filter((p) => {
        const q = busquedaVenta.trim().toLowerCase();
        return p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
      })
    : [];

  function agregarAlTicket(producto) {
    if (producto.stock <= 0) {
      setMensaje({ tipo: "error", texto: `"${producto.nombre}" no tiene stock disponible.` });
      return;
    }
    const yaEnTicket = ticket.find((it) => it.id === producto.id);
    const entrada = window.prompt(
      `¿Cuántas unidades de "${producto.nombre}" vas a facturar?\nDisponible en stock: ${producto.stock}`,
      yaEnTicket ? String(yaEnTicket.cantidad) : "1"
    );
    if (entrada === null) return;
    const cantidad = parseInt(entrada, 10);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setMensaje({ tipo: "error", texto: "Cantidad inválida." });
      return;
    }
    if (cantidad > producto.stock) {
      setMensaje({ tipo: "error", texto: `Solo hay ${producto.stock} unidades disponibles de "${producto.nombre}".` });
      return;
    }
    setTicket((prev) => {
      const existe = prev.find((it) => it.id === producto.id);
      if (existe) return prev.map((it) => (it.id === producto.id ? { ...it, cantidad } : it));
      return [
        ...prev,
        { id: producto.id, codigo: producto.codigo, nombre: producto.nombre, precioVenta: producto.precioVenta, cantidad, stockDisponible: producto.stock },
      ];
    });
    setBusquedaVenta("");
  }

  function cambiarCantidadTicket(id, delta) {
    setTicket((prev) =>
      prev
        .map((it) => {
          if (it.id !== id) return it;
          const nuevaCantidad = it.cantidad + delta;
          if (nuevaCantidad > it.stockDisponible) {
            setMensaje({ tipo: "error", texto: `Solo quedan ${it.stockDisponible} unidades de "${it.nombre}".` });
            return it;
          }
          return { ...it, cantidad: nuevaCantidad };
        })
        .filter((it) => it.cantidad > 0)
    );
  }

  function quitarDelTicket(id) {
    setTicket((prev) => prev.filter((it) => it.id !== id));
  }

  const totalTicket = ticket.reduce((acc, it) => acc + it.precioVenta * it.cantidad, 0);
  const totalUnidades = ticket.reduce((acc, it) => acc + it.cantidad, 0);

  const montoRecibidoNum = Number(montoRecibido) || 0;
  const cambioCalculado = montoRecibidoNum - totalTicket;

  function abrirPago() {
    if (ticket.length === 0) return;
    setMetodoPago("efectivo");
    setMontoRecibido("");
    setPagoAbierto(true);
  }

  function cancelarPago() {
    setPagoAbierto(false);
    setMontoRecibido("");
  }

  async function confirmarVenta() {
    if (metodoPago === "efectivo" && montoRecibidoNum < totalTicket) {
      setMensaje({ tipo: "error", texto: "El monto recibido es menor al total." });
      return;
    }
    const ventaNueva = {
      id: nuevoId(),
      fecha: new Date().toISOString(),
      vendedor: sesion.nombre,
      total: totalTicket,
      metodo_pago: metodoPago,
      monto_recibido: metodoPago === "efectivo" ? montoRecibidoNum : null,
      cambio: metodoPago === "efectivo" ? cambioCalculado : null,
      items: ticket.map((it) => ({ id: it.id, codigo: it.codigo, nombre: it.nombre, precioVenta: it.precioVenta, cantidad: it.cantidad })),
    };
    const { data, error: eVenta } = await supabase.from("ventas").insert(ventaNueva).select().single();
    if (eVenta) {
      setMensaje({ tipo: "error", texto: "No se pudo registrar la venta. Intenta de nuevo." });
      return;
    }
    await Promise.all(
      ticket.map((it) => {
        const p = productos.find((prod) => prod.id === it.id);
        const nuevoStock = p ? Math.max(0, p.stock - it.cantidad) : 0;
        return supabase.from("productos").update({ stock: nuevoStock }).eq("id", it.id);
      })
    );
    setProductos((prev) =>
      prev.map((p) => {
        const item = ticket.find((it) => it.id === p.id);
        return item ? { ...p, stock: Math.max(0, p.stock - item.cantidad) } : p;
      })
    );
    const ventaGuardada = mapVentaDesdeDB(data);
    setVentas((prev) => [ventaGuardada, ...prev]);
    setVentaParaImprimir(ventaGuardada);
    setTicket([]);
    setPagoAbierto(false);
    setMontoRecibido("");
    setMensaje({ tipo: "exito", texto: `Venta #${ventaGuardada.numero} registrada por ${formatoMoneda(totalTicket)}.` });
  }

  function imprimirVenta(venta) {
    setVentaParaImprimir(venta);
    setTimeout(() => window.print(), 150);
  }

  async function anularVenta(id) {
    const venta = ventas.find((v) => v.id === id);
    if (!venta) return;
    if (!confirm("¿Anular esta venta? El stock de los productos se devolverá al inventario.")) return;
    await Promise.all(
      venta.items.map((it) => {
        const p = productos.find((prod) => prod.id === it.id);
        if (!p) return Promise.resolve();
        return supabase.from("productos").update({ stock: p.stock + it.cantidad }).eq("id", it.id);
      })
    );
    const { error: err } = await supabase.from("ventas").delete().eq("id", id);
    if (err) {
      setMensaje({ tipo: "error", texto: "No se pudo anular la venta." });
      return;
    }
    setProductos((prev) =>
      prev.map((p) => {
        const item = venta.items.find((it) => it.id === p.id);
        return item ? { ...p, stock: p.stock + item.cantidad } : p;
      })
    );
    setVentas((prev) => prev.filter((v) => v.id !== id));
    setMensaje({ tipo: "exito", texto: "Venta anulada y stock restaurado." });
  }

  function exportarExcel() {
    const hojaProductos = productos.map((p) => {
      const margen = p.precioIngreso > 0 ? (((p.precioVenta - p.precioIngreso) / p.precioIngreso) * 100).toFixed(1) + "%" : "";
      return {
        "Código": p.codigo, "Producto": p.nombre, "Categoría": p.categoria, "Stock": p.stock,
        "Precio de ingreso": p.precioIngreso, "Precio de venta": p.precioVenta, "Margen": margen,
      };
    });
    const hojaVentas = ventas.flatMap((v) =>
      v.items.map((it) => ({
        "Venta #": v.numero, "Fecha": new Date(v.fecha).toLocaleString("es-CO"), "Vendedor": v.vendedor || "—",
        "Código": it.codigo, "Producto": it.nombre, "Cantidad": it.cantidad,
        "Precio unitario": it.precioVenta, "Subtotal": it.precioVenta * it.cantidad, "Total de la venta": v.total,
        "Método de pago": v.metodoPago === "efectivo" ? "Efectivo" : "Transferencia",
        "Recibido": v.montoRecibido ?? "", "Cambio": v.cambio ?? "",
      }))
    );
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(hojaProductos), "Inventario");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(hojaVentas), "Ventas");
    XLSX.writeFile(libro, `minimarket-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const estilos = `
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
    .mm-root { --paper: #FFFDF7; --bg-page: #EFEAD9; --ink: #22301F; --green: #2F6B4F;
      --green-dark: #1F4D38; --red: #B5441F; --yellow: #E8B23D; --line: #D8CFB8;
      --muted: #8a8265; font-family: 'Inter', sans-serif; color: var(--ink); background: var(--bg-page); }
    .mm-display { font-family: 'Oswald', sans-serif; }
    .mm-header { background: var(--green-dark); color: var(--paper); }
    .mm-header-inner { max-width: 1150px; margin: 0 auto; padding: 14px 20px; display: flex;
      align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .mm-tabs { display: flex; gap: 4px; }
    .mm-tab { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: transparent;
      border: none; color: rgba(255,253,247,0.72); font-family: 'Inter', sans-serif; font-size: 13.5px;
      font-weight: 500; cursor: pointer; border-radius: 4px 4px 0 0; }
    .mm-tab.active { background: var(--paper); color: var(--green-dark); font-weight: 600; }
    .mm-tab:hover:not(.active) { color: var(--paper); background: rgba(255,255,255,0.1); }
    .mm-tab:disabled { opacity: 0.5; cursor: not-allowed; }
    .mm-toast { padding: 10px 20px; color: #fff; font-size: 13.5px; font-weight: 500; }
    .mm-main { max-width: 1150px; margin: 0 auto; padding: 20px; }
    .mm-search { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid var(--line);
      padding: 9px 12px; flex: 1; min-width: 220px; }
    .mm-search input { border: none; outline: none; flex: 1; font-size: 14px; font-family: 'Inter', sans-serif;
      background: transparent; color: var(--ink); }
    .mm-search svg { color: var(--muted); flex-shrink: 0; }
    .mm-btn-primary { display: inline-flex; align-items: center; gap: 6px; background: var(--green); color: #fff;
      border: none; padding: 9px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .mm-btn-primary:hover { background: var(--green-dark); }
    .mm-btn-primary:disabled { background: #c8c2ab; cursor: not-allowed; }
    .mm-btn-secondary { display: inline-flex; align-items: center; gap: 6px; background: transparent; color: var(--ink);
      border: 1px solid var(--line); padding: 9px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .mm-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
      background: #fff; border: 1px solid var(--line); color: var(--ink); cursor: pointer; padding: 0; }
    .mm-icon-btn:hover { border-color: var(--green); color: var(--green); }
    .mm-icon-btn-lg { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
      background: #fff; border: 1px solid var(--line); color: var(--ink); cursor: pointer; padding: 0; }
    .mm-icon-btn-lg:hover { border-color: var(--green); color: var(--green); }
    .mm-panel { background: #fff; border: 1px solid var(--line); padding: 16px; }
    .mm-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .mm-form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: #6b6448; font-weight: 500; }
    .mm-form-grid input, .mm-form-grid select { border: 1px solid var(--line); padding: 8px 10px; font-size: 14px; font-family: 'Inter', sans-serif; color: var(--ink); background: #fff; }
    .mm-form-grid input:focus, .mm-form-grid select:focus { outline: 2px solid var(--green); outline-offset: -1px; }
    .mm-table-wrap { background: #fff; border: 1px solid var(--line); overflow-x: auto; }
    .mm-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .mm-table th { text-align: left; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--muted); border-bottom: 1px solid var(--line); font-weight: 600; }
    .mm-table td { padding: 10px 14px; border-bottom: 1px solid #f0ebd9; vertical-align: middle; }
    .mm-table tr:last-child td { border-bottom: none; }
    .mm-resultado { display: flex; justify-content: space-between; align-items: center; width: 100%; background: transparent;
      border: none; border-bottom: 1px solid #f0ebd9; padding: 12px 10px; cursor: pointer; text-align: left; font-family: 'Inter', sans-serif; }
    .mm-resultado:last-child { border-bottom: none; }
    .mm-resultado:hover:not(:disabled) { background: #faf6ec; }
    .mm-resultado:disabled { cursor: not-allowed; opacity: 0.5; }
    .mm-facturar-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 20px; align-items: start; }
    @media (max-width: 720px) { .mm-facturar-grid { grid-template-columns: 1fr; } }
    .mm-ticket { background: var(--paper); border: 1px solid var(--line); position: relative; }
    .mm-ticket-body { padding: 20px 20px 6px; }
    .mm-ticket-footer { padding: 0 20px 20px; }
    .mm-zigzag { height: 12px; margin-top: -1px;
      background-image: linear-gradient(-45deg, var(--bg-page) 6px, transparent 0), linear-gradient(45deg, var(--bg-page) 6px, transparent 0);
      background-size: 12px 12px; background-position: bottom; background-repeat: repeat-x; }
    .mm-link { background: none; border: none; color: var(--muted); font-size: 12.5px; text-decoration: underline; cursor: pointer; padding: 0; }
    .mm-link:hover { color: var(--red); }
    .mm-pago-metodo { display: flex; gap: 8px; margin-bottom: 14px; }
    .mm-pago-metodo button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 12px; border: 1px solid var(--line); background: #fff; color: var(--ink); font-size: 14px;
      font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; }
    .mm-pago-metodo button.active { background: var(--green); color: #fff; border-color: var(--green); }
    .mm-cambio-box { background: var(--bg-page); border: 1px dashed var(--line); padding: 12px; margin-top: 10px;
      display: flex; justify-content: space-between; align-items: baseline; }
    .mm-recibo { position: absolute; left: -9999px; top: 0; width: 280px; font-family: 'Inter', sans-serif; color: #000; }
    @media print {
      body * { visibility: hidden; }
      .mm-recibo, .mm-recibo * { visibility: visible; }
      .mm-recibo { position: absolute; left: 0; top: 0; }
    }
    .mm-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    @media (max-width: 640px) { .mm-stats-row { grid-template-columns: 1fr; } }
    .mm-stat-box { background: #fff; border: 1px solid var(--line); padding: 14px; text-align: center; }
    .mm-stat-box .valor { font-family: 'Oswald', sans-serif; font-size: 1.6rem; color: var(--green-dark); }
    .mm-stat-box .etiqueta { font-size: 12px; color: var(--muted); margin-top: 4px; }
    .mm-auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .mm-auth-card { background: #fff; border: 1px solid var(--line); padding: 28px; width: 100%; max-width: 340px; }
    .mm-auth-form { display: flex; flex-direction: column; gap: 12px; }
    .mm-auth-form label { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: #6b6448; font-weight: 500; }
    .mm-auth-form input { border: 1px solid var(--line); padding: 9px 10px; font-size: 14px; font-family: 'Inter', sans-serif; color: var(--ink); }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-1 { gap: 4px; }
    .gap-2 { gap: 8px; }
    .gap-3 { gap: 12px; }
    .animate-spin { animation: mm-spin 1s linear infinite; }
    @keyframes mm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `;

  if (cargando) {
    return (
      <div className="mm-root" style={{ minHeight: "400px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{estilos}</style>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
          <Loader2 className="animate-spin" size={18} />
          Conectando con la base de datos...
        </div>
      </div>
    );
  }

  if (usuarios.length === 0) {
    return (
      <div className="mm-root mm-auth-wrap">
        <style>{estilos}</style>
        <div className="mm-auth-card">
          <div className="flex items-center gap-2" style={{ justifyContent: "center", marginBottom: "6px" }}>
            <Store size={22} />
            <span className="mm-display" style={{ fontSize: "1.2rem" }}>Minimarket</span>
          </div>
          <div style={{ textAlign: "center", fontSize: "12.5px", color: "var(--muted)", marginBottom: "18px" }}>
            Primer uso — crea la cuenta de administrador
          </div>
          <form onSubmit={crearPrimerAdmin} className="mm-auth-form">
            <label>Tu nombre
              <input value={setupNombre} onChange={(e) => setSetupNombre(e.target.value)} placeholder="Ej. Eva María" autoFocus />
            </label>
            <label>Usuario
              <input value={setupUsuario} onChange={(e) => setSetupUsuario(e.target.value)} placeholder="Ej. eva.admin" />
            </label>
            <label>Contraseña
              <input type="password" value={setupClave} onChange={(e) => setSetupClave(e.target.value)} placeholder="Mínimo 4 caracteres" />
            </label>
            <label>Confirmar contraseña
              <input type="password" value={setupClave2} onChange={(e) => setSetupClave2(e.target.value)} />
            </label>
            {setupError && <div style={{ color: "var(--red)", fontSize: "12.5px" }}>{setupError}</div>}
            <button type="submit" className="mm-btn-primary" style={{ justifyContent: "center" }}>Crear cuenta y entrar</button>
          </form>
        </div>
      </div>
    );
  }

  if (!sesion) {
    return (
      <div className="mm-root mm-auth-wrap">
        <style>{estilos}</style>
        <div className="mm-auth-card">
          <div className="flex items-center gap-2" style={{ justifyContent: "center", marginBottom: "18px" }}>
            <Store size={22} />
            <span className="mm-display" style={{ fontSize: "1.2rem" }}>Minimarket</span>
          </div>
          <form onSubmit={iniciarSesion} className="mm-auth-form">
            <label>Usuario
              <input value={loginUsuario} onChange={(e) => setLoginUsuario(e.target.value)} autoFocus />
            </label>
            <label>Contraseña
              <input type="password" value={loginClave} onChange={(e) => setLoginClave(e.target.value)} />
            </label>
            {loginError && <div style={{ color: "var(--red)", fontSize: "12.5px" }}>{loginError}</div>}
            <button type="submit" className="mm-btn-primary" style={{ justifyContent: "center" }}>Iniciar sesión</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mm-root" style={{ minHeight: "600px" }}>
      <style>{estilos}</style>

      <header className="mm-header">
        <div className="mm-header-inner">
          <div className="flex items-center gap-2">
            <Store size={22} />
            <span className="mm-display" style={{ fontSize: "1.25rem", letterSpacing: "0.02em" }}>Minimarket</span>
          </div>
          <nav className="mm-tabs">
            <button className={`mm-tab ${vista === "facturar" ? "active" : ""}`} onClick={() => setVista("facturar")}>
              <ShoppingCart size={16} /> Facturar
            </button>
            <button className={`mm-tab ${vista === "inventario" ? "active" : ""}`} onClick={() => setVista("inventario")}>
              <Package size={16} /> Inventario
            </button>
            <button className={`mm-tab ${vista === "historial" ? "active" : ""}`} onClick={() => setVista("historial")}>
              <History size={16} /> Historial
            </button>
            {isAdmin && (
              <button className={`mm-tab ${vista === "usuarios" ? "active" : ""}`} onClick={() => setVista("usuarios")}>
                <Users size={16} /> Usuarios
              </button>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <button className="mm-tab" onClick={() => recargarTodo(true)} disabled={sincronizando} title="Actualizar datos">
              <RefreshCw size={16} className={sincronizando ? "animate-spin" : ""} />
            </button>
            <div style={{ fontSize: "12.5px", color: "rgba(255,253,247,0.85)" }}>
              {sesion.nombre} <span style={{ opacity: 0.6 }}>· {isAdmin ? "Administrador" : "Vendedor"}</span>
            </div>
            {isAdmin && (
              <button className="mm-tab" onClick={exportarExcel} title="Exportar inventario y ventas a Excel">
                <Download size={16} /> Excel
              </button>
            )}
            <button className="mm-tab" onClick={cerrarSesion}>
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
      </header>

      {mensaje && (
        <div className="mm-toast" style={{ background: mensaje.tipo === "error" ? "var(--red)" : "var(--green)" }}>
          {mensaje.texto}
        </div>
      )}
      {error && <div className="mm-toast" style={{ background: "var(--red)" }}>{error}</div>}

      <main className="mm-main">
        {vista === "inventario" && (
          <div>
            <div className="flex items-center justify-between gap-3" style={{ marginBottom: "14px", flexWrap: "wrap" }}>
              <div className="mm-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar por nombre o código..."
                  value={busquedaInventario}
                  onChange={(e) => setBusquedaInventario(e.target.value)}
                />
              </div>
              {isAdmin && (
                <button className="mm-btn-primary" onClick={abrirNuevo}>
                  <Plus size={16} /> Nuevo producto
                </button>
              )}
            </div>

            {!isAdmin && (
              <div style={{ marginBottom: "12px", fontSize: "12.5px", color: "var(--muted)" }}>
                Vista de solo lectura. Solo el administrador puede editar el inventario.
              </div>
            )}

            {formAbierto && isAdmin && (
              <form onSubmit={guardarForm} className="mm-panel" style={{ marginBottom: "16px" }}>
                <div className="mm-form-grid">
                  <label>Código
                    <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ej. 001" />
                  </label>
                  <label>Nombre
                    <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Ej. Arroz Diana 500g" />
                  </label>
                  <label>Categoría
                    <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ej. Abarrotes" />
                  </label>
                  <label>Stock
                    <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
                  </label>
                  <label>Precio de ingreso
                    <input type="number" min="0" value={form.precioIngreso} onChange={(e) => setForm({ ...form, precioIngreso: e.target.value })} placeholder="0" />
                  </label>
                  <label>Precio de venta
                    <input type="number" min="0" value={form.precioVenta} onChange={(e) => setForm({ ...form, precioVenta: e.target.value })} placeholder="0" />
                  </label>
                </div>
                <div className="flex gap-2" style={{ marginTop: "12px" }}>
                  <button type="submit" className="mm-btn-primary">
                    <Check size={16} /> {editandoId ? "Guardar cambios" : "Agregar producto"}
                  </button>
                  <button type="button" className="mm-btn-secondary" onClick={cerrarForm}>
                    <X size={16} /> Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="mm-table-wrap">
              <table className="mm-table">
                <thead>
                  <tr><th>Código</th><th>Producto</th><th>Stock</th><th>P. ingreso</th><th>P. venta</th><th>Margen</th><th></th></tr>
                </thead>
                <tbody>
                  {productosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>
                        {productos.length === 0 ? "Todavía no hay productos. Agrega el primero." : "No se encontraron productos."}
                      </td>
                    </tr>
                  )}
                  {productosFiltrados.map((p) => {
                    const margen = p.precioIngreso > 0 ? ((p.precioVenta - p.precioIngreso) / p.precioIngreso) * 100 : null;
                    const stockBajo = p.stock <= UMBRAL_STOCK_BAJO;
                    return (
                      <tr key={p.id}>
                        <td style={{ color: "var(--muted)" }}>{p.codigo || "—"}</td>
                        <td>{p.nombre}{p.categoria && <div style={{ fontSize: "12px", color: "var(--muted)" }}>{p.categoria}</div>}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {isAdmin && <button className="mm-icon-btn" onClick={() => ajustarStock(p.id, -1)}><Minus size={12} /></button>}
                            <span style={{ color: stockBajo ? "var(--red)" : "var(--ink)", fontWeight: 600, minWidth: "20px", textAlign: "center" }}>{p.stock}</span>
                            {isAdmin && <button className="mm-icon-btn" onClick={() => ajustarStock(p.id, 1)}><Plus size={12} /></button>}
                            {stockBajo && <AlertTriangle size={13} style={{ color: "var(--red)" }} />}
                          </div>
                        </td>
                        <td>{formatoMoneda(p.precioIngreso)}</td>
                        <td className="mm-display" style={{ fontWeight: 600 }}>{formatoMoneda(p.precioVenta)}</td>
                        <td>{margen !== null ? `${margen.toFixed(0)}%` : "—"}</td>
                        <td>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <button className="mm-icon-btn" onClick={() => abrirEdicion(p)}><Pencil size={13} /></button>
                              <button className="mm-icon-btn" onClick={() => eliminarProducto(p.id)}><Trash2 size={13} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {productos.length > 0 && isAdmin && (
              <div style={{ marginTop: "10px", textAlign: "right" }}>
                <button className="mm-link" onClick={borrarInventario}>Borrar todo el inventario</button>
              </div>
            )}
          </div>
        )}

        {vista === "facturar" && (
          <div className="mm-facturar-grid">
            <div>
              <div className="mm-search" style={{ marginBottom: "12px" }}>
                <Search size={16} />
                <input
                  type="text" autoFocus
                  placeholder="Buscar o escanear producto por nombre o código..."
                  value={busquedaVenta}
                  onChange={(e) => setBusquedaVenta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && resultadosVenta.length === 1) {
                      e.preventDefault();
                      agregarAlTicket(resultadosVenta[0]);
                    }
                  }}
                />
              </div>
              {busquedaVenta.trim() ? (
                <div className="mm-panel" style={{ padding: "6px" }}>
                  {resultadosVenta.length === 0 && (
                    <div style={{ padding: "12px", color: "var(--muted)", fontSize: "14px" }}>Sin resultados para "{busquedaVenta}".</div>
                  )}
                  {resultadosVenta.map((p) => (
                    <button key={p.id} className="mm-resultado" onClick={() => agregarAlTicket(p)} disabled={p.stock <= 0}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "15px" }}>{p.nombre}</div>
                        <div style={{ fontSize: "12.5px", color: "var(--muted)" }}>{p.codigo && `Cód. ${p.codigo} · `}Stock: {p.stock}</div>
                      </div>
                      <div className="mm-display" style={{ fontSize: "1.25rem", color: p.stock <= 0 ? "#b8b19a" : "var(--green-dark)" }}>
                        {formatoMoneda(p.precioVenta)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "40px 12px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>
                  Escribe el nombre o código de un producto. Al seleccionarlo te preguntará la cantidad a facturar.
                </div>
              )}
            </div>

            <div className="mm-ticket">
              <div className="mm-ticket-body">
                <div className="mm-display" style={{ fontSize: "1.2rem", textAlign: "center", marginBottom: "4px" }}>VENTA ACTUAL</div>
                <div style={{ textAlign: "center", fontSize: "12.5px", color: "var(--muted)", marginBottom: "16px" }}>
                  {new Date().toLocaleString("es-CO")} · {sesion.nombre}
                </div>
                {ticket.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "14px", padding: "24px 0" }}>Aún no has agregado productos.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {ticket.map((it) => (
                      <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", borderBottom: "1px dashed var(--line)", paddingBottom: "12px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "16px", fontWeight: 600 }}>{it.nombre}</div>
                          <div style={{ fontSize: "13px", color: "var(--muted)" }}>{formatoMoneda(it.precioVenta)} c/u</div>
                          <div className="flex items-center gap-2" style={{ marginTop: "6px" }}>
                            <button className="mm-icon-btn-lg" onClick={() => cambiarCantidadTicket(it.id, -1)}><Minus size={14} /></button>
                            <span style={{ minWidth: "24px", textAlign: "center", fontSize: "17px", fontWeight: 600 }}>{it.cantidad}</span>
                            <button className="mm-icon-btn-lg" onClick={() => cambiarCantidadTicket(it.id, 1)}><Plus size={14} /></button>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="mm-display" style={{ fontWeight: 600, fontSize: "1.3rem" }}>{formatoMoneda(it.precioVenta * it.cantidad)}</div>
                          <button className="mm-icon-btn" onClick={() => quitarDelTicket(it.id)} style={{ marginTop: "6px" }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mm-ticket-footer">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--muted)" }}>
                  <span>{totalUnidades} unidad{totalUnidades !== 1 ? "es" : ""}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "8px 0 18px" }}>
                  <span className="mm-display" style={{ fontSize: "1.3rem" }}>TOTAL</span>
                  <span className="mm-display" style={{ fontSize: "2.4rem", color: "var(--green-dark)" }}>{formatoMoneda(totalTicket)}</span>
                </div>

                {!pagoAbierto ? (
                  <button
                    className="mm-btn-primary"
                    style={{ width: "100%", justifyContent: "center", fontSize: "16px", padding: "14px 18px" }}
                    onClick={abrirPago}
                    disabled={ticket.length === 0}
                  >
                    <Check size={18} /> Cobrar venta
                  </button>
                ) : (
                  <div>
                    <div className="mm-pago-metodo">
                      <button className={metodoPago === "efectivo" ? "active" : ""} onClick={() => setMetodoPago("efectivo")}>
                        <Banknote size={16} /> Efectivo
                      </button>
                      <button className={metodoPago === "transferencia" ? "active" : ""} onClick={() => setMetodoPago("transferencia")}>
                        <Landmark size={16} /> Transferencia
                      </button>
                    </div>

                    {metodoPago === "efectivo" && (
                      <div style={{ marginBottom: "6px" }}>
                        <label style={{ fontSize: "12.5px", color: "#6b6448", fontWeight: 500, display: "block", marginBottom: "4px" }}>
                          ¿Con cuánto paga?
                        </label>
                        <input
                          type="number" min="0" autoFocus
                          value={montoRecibido}
                          onChange={(e) => setMontoRecibido(e.target.value)}
                          placeholder="0"
                          style={{ width: "100%", border: "1px solid var(--line)", padding: "12px", fontSize: "18px", fontFamily: "'Oswald', sans-serif" }}
                        />
                        <div className="mm-cambio-box">
                          <span style={{ fontSize: "13px", color: "var(--muted)" }}>Cambio</span>
                          <span className="mm-display" style={{ fontSize: "1.4rem", color: cambioCalculado < 0 ? "var(--red)" : "var(--green-dark)" }}>
                            {formatoMoneda(Math.max(cambioCalculado, 0))}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2" style={{ marginTop: "12px" }}>
                      <button
                        className="mm-btn-primary"
                        style={{ flex: 1, justifyContent: "center", fontSize: "15px", padding: "12px" }}
                        onClick={confirmarVenta}
                        disabled={metodoPago === "efectivo" && montoRecibidoNum < totalTicket}
                      >
                        <Check size={16} /> Confirmar venta
                      </button>
                      <button className="mm-btn-secondary" onClick={cancelarPago}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {!pagoAbierto && ventaParaImprimir && ticket.length === 0 && (
                  <button
                    className="mm-btn-secondary"
                    style={{ width: "100%", justifyContent: "center", marginTop: "10px" }}
                    onClick={() => imprimirVenta(ventaParaImprimir)}
                  >
                    <Printer size={16} /> Imprimir última venta (#{ventaParaImprimir.numero})
                  </button>
                )}
              </div>
              <div className="mm-zigzag" />
            </div>
          </div>
        )}

        {vista === "historial" && (
          <div>
            {(() => {
              const hoyStr = new Date().toDateString();
              const ventasHoy = ventas.filter((v) => new Date(v.fecha).toDateString() === hoyStr);
              const totalHoy = ventasHoy.reduce((acc, v) => acc + v.total, 0);
              const unidadesHoy = ventasHoy.reduce((acc, v) => acc + v.items.reduce((a, it) => a + it.cantidad, 0), 0);
              return (
                <div className="mm-stats-row">
                  <div className="mm-stat-box">
                    <div className="valor">{ventasHoy.length}</div>
                    <div className="etiqueta">Ventas hoy</div>
                  </div>
                  <div className="mm-stat-box">
                    <div className="valor">{formatoMoneda(totalHoy)}</div>
                    <div className="etiqueta">Total vendido hoy</div>
                  </div>
                  <div className="mm-stat-box">
                    <div className="valor">{unidadesHoy}</div>
                    <div className="etiqueta">Unidades vendidas hoy</div>
                  </div>
                </div>
              );
            })()}

            {ventas.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0" }}>Todavía no se ha registrado ninguna venta.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {ventas.map((v) => (
                  <div key={v.id} className="mm-panel" style={{ padding: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <div
                        role="button" tabIndex={0} style={{ cursor: "pointer", flex: 1 }}
                        onClick={() => setExpandido(expandido === v.id ? null : v.id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpandido(expandido === v.id ? null : v.id)}
                      >
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>
                          Venta #{v.numero} · {new Date(v.fecha).toLocaleString("es-CO")}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                          {v.items.length} producto{v.items.length !== 1 ? "s" : ""} · Vendedor: {v.vendedor || "—"} ·{" "}
                          {v.metodoPago === "efectivo" ? "Efectivo" : "Transferencia"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="mm-display" style={{ fontSize: "1.1rem", color: "var(--green-dark)", cursor: "pointer" }} onClick={() => setExpandido(expandido === v.id ? null : v.id)}>
                          {formatoMoneda(v.total)}
                        </div>
                        <button className="mm-icon-btn" title="Imprimir" onClick={() => imprimirVenta(v)}>
                          <Printer size={13} />
                        </button>
                        {isAdmin && (
                          <button className="mm-icon-btn" title="Anular venta" onClick={() => anularVenta(v.id)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    {expandido === v.id && (
                      <div style={{ marginTop: "10px", borderTop: "1px dashed var(--line)", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {v.items.map((it, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                            <span>{it.cantidad} × {it.nombre}</span>
                            <span>{formatoMoneda(it.precioVenta * it.cantidad)}</span>
                          </div>
                        ))}
                        {v.metodoPago === "efectivo" && v.montoRecibido != null && (
                          <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed var(--line)", fontSize: "13px", color: "var(--muted)" }}>
                            Recibido: {formatoMoneda(v.montoRecibido)} · Cambio: {formatoMoneda(v.cambio)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {vista === "usuarios" && isAdmin && (
          <div>
            <div className="flex items-center justify-between gap-3" style={{ marginBottom: "14px", flexWrap: "wrap" }}>
              <div className="mm-display" style={{ fontSize: "1.1rem" }}>Usuarios del sistema</div>
              <button className="mm-btn-primary" onClick={abrirNuevoUsuario}>
                <UserPlus size={16} /> Nuevo usuario
              </button>
            </div>

            {formUsuarioAbierto && (
              <form onSubmit={guardarFormUsuario} className="mm-panel" style={{ marginBottom: "16px" }}>
                <div className="mm-form-grid">
                  <label>Nombre
                    <input value={formUsuario.nombre} onChange={(e) => setFormUsuario({ ...formUsuario, nombre: e.target.value })} required placeholder="Ej. Juan Pérez" />
                  </label>
                  <label>Usuario
                    <input value={formUsuario.usuario} onChange={(e) => setFormUsuario({ ...formUsuario, usuario: e.target.value })} required disabled={!!editandoUsuario} placeholder="Ej. juan.ventas" />
                  </label>
                  <label>Contraseña
                    <input type="password" value={formUsuario.clave} onChange={(e) => setFormUsuario({ ...formUsuario, clave: e.target.value })} placeholder={editandoUsuario ? "Dejar en blanco para no cambiarla" : "Mínimo 4 caracteres"} />
                  </label>
                  <label>Rol
                    <select value={formUsuario.rol} onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value })}>
                      <option value="vendedor">Vendedor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </label>
                </div>
                <div className="flex gap-2" style={{ marginTop: "12px" }}>
                  <button type="submit" className="mm-btn-primary">
                    <Check size={16} /> {editandoUsuario ? "Guardar cambios" : "Crear usuario"}
                  </button>
                  <button type="button" className="mm-btn-secondary" onClick={cerrarFormUsuario}>
                    <X size={16} /> Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="mm-table-wrap">
              <table className="mm-table">
                <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th></th></tr></thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.usuario}>
                      <td>{u.nombre}</td>
                      <td>{u.usuario}</td>
                      <td>{u.rol === "admin" ? "Administrador" : "Vendedor"}</td>
                      <td>
                        <div className="flex gap-1">
                          <button className="mm-icon-btn" onClick={() => abrirEdicionUsuario(u)}><Pencil size={13} /></button>
                          <button className="mm-icon-btn" onClick={() => eliminarUsuario(u.usuario)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {ventaParaImprimir && (
        <div className="mm-recibo">
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: "16px" }}>MINIMARKET</div>
          <div style={{ textAlign: "center", fontSize: "12px", marginBottom: "8px" }}>
            Venta #{ventaParaImprimir.numero}<br />
            {new Date(ventaParaImprimir.fecha).toLocaleString("es-CO")}<br />
            Vendedor: {ventaParaImprimir.vendedor}
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          {ventaParaImprimir.items.map((it, i) => (
            <div key={i} style={{ fontSize: "12px", marginBottom: "3px" }}>
              <div>{it.nombre}</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{it.cantidad} x {formatoMoneda(it.precioVenta)}</span>
                <span>{formatoMoneda(it.precioVenta * it.cantidad)}</span>
              </div>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "15px" }}>
            <span>TOTAL</span>
            <span>{formatoMoneda(ventaParaImprimir.total)}</span>
          </div>
          <div style={{ fontSize: "12px", marginTop: "6px" }}>
            Pago: {ventaParaImprimir.metodoPago === "efectivo" ? "Efectivo" : "Transferencia"}
            {ventaParaImprimir.metodoPago === "efectivo" && ventaParaImprimir.montoRecibido != null && (
              <>
                <br />Recibido: {formatoMoneda(ventaParaImprimir.montoRecibido)}
                <br />Cambio: {formatoMoneda(ventaParaImprimir.cambio)}
              </>
            )}
          </div>
          <div style={{ textAlign: "center", fontSize: "12px", marginTop: "10px" }}>¡Gracias por su compra!</div>
        </div>
      )}
    </div>
  );
}
