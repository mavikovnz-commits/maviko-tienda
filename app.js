'use strict';

const GOOGLE_SHEET_ID = "1COZTlUBgqv2GPT6TMG1mfkkvliprvBGZw4-0-PTw5dM";
const GID_CATALOGO_WEB = "1599022863";
const WEBHOOK_APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlSDhHTEkH7Kd_ZVS-wwZf2c1AMba5PrW8pYemAwnOhYf-3a8v9CVcU3VFRvghgjFP/exec";
const NUMERO_WHATSAPP = "584127701750";
const META_ENVIO_USD = 60;
const PRODUCTOS_POR_PAGINA = 24;
const IMAGEN_RESPALDO = "./icon-192.png";

const MARCAS_CONOCIDAS = [
  "Nike", "Jordan", "Adidas", "New Balance", "Puma", "Converse", "Vans",
  "Skechers", "Under Armour", "Reebok", "Crocs", "Timberland", "Fila", "Asics",
  "Caterpillar", "CAT", "Brooks", "Hoka", "On Cloud", "Saucony", "Mizuno", "Merrell", "Salomon", "DC",
  "Tommy Hilfiger", "Ralph Lauren", "Lacoste", "Calvin Klein", "Guess", "Coach",
  "Michael Kors", "Kate Spade", "Steve Madden", "Victoria's Secret", "Bath & Body Works",
  "Nautica", "US Polo", "Kenneth Cole", "Nine West", "Aldo", "Hollister", "Abercrombie", "Old Navy", "Gap",
  "Zara", "Shein", "CeraVe", "La Roche-Posay", "Eucerin", "Neutrogena", "Cetaphil",
  "The Ordinary", "Garnier", "L'Oreal", "Maybelline", "MAC", "Rare Beauty", "Sheglam", "Revlon", "NYX", "Dior",
  "Chanel", "Carolina Herrera", "Paco Rabanne", "Lattafa", "Armaf", "Rasasi", "Afnan", "Bharara",
  "Versace", "Armani", "Casio", "G-Shock", "Fossil", "Invicta",
  "Stanley", "Yeti", "Owala", "Jansport", "Kipling", "Totto", "The North Face", "Columbia", "Champion",
  "Levi's", "Oakley", "Ray-Ban", "Apple", "Samsung", "Xiaomi", "JBL", "Sony", "Anker",
  "Nivea", "Bioderma", "Isdin", "Vichy", "Avene", "Clinique", "Estee Lauder",
  "Kylie", "Fenty", "Sol de Janeiro", "Tree Hut", "Olaplex", "Pantene", "Dove"
];

const ALIAS_MARCAS = {
  caterpillar: "CAT",
  cat: "CAT"
};

const STORAGE_KEYS = {
  CARRITO: 'maviko_carrito',
  CARRITO_TS: 'maviko_carrito_timestamp',
  CATALOGO: 'maviko_catalogo_cache_v1',
  TASA_BCV: 'maviko_tasa_bcv_cache',
  FAVORITOS: 'maviko_favoritos_v1',
  OFERTAS_VISTAS: 'maviko_ofertas_vistas',
  CUPONES_VERIFICADOS: 'maviko_cupones_verificados',
  CLIENTE: 'maviko_cliente_v1'
};

const DATOS_PAGO_MOVIL = {
  banco: "Banco de Venezuela (0102)",
  cedula: "V-20.907.946",
  telefono: "0412-7701750"
};

let tasaBCV = parseFloat(localStorage.getItem(STORAGE_KEYS.TASA_BCV)) || 0;
let productos = [];
let carrito = leerJSONStorage(STORAGE_KEYS.CARRITO, []);
let favoritos = leerJSONStorage(STORAGE_KEYS.FAVORITOS, []);
let categoriaActual = 'todas';
let marcaActual = 'todas';
let tallaActual = 'todas';
let paginaActual = 1;
let soloInmediata = false;
let soloFavoritos = false;
let filtrosURLAplicados = false;
let productoModalActual = null;
let tallaSeleccionadaActual = "";
let costoEnvioAdicional = 0;
let cuponAplicado = null; // { codigo, descuentoUSD, minCompraUSD }
let toastTimeout = null;
let timerEsperaJSONP = null;
let timerAbandonoLead = null;
let eventoInstalacionDirecta = null;
let intervaloCarruselModal = null;
let fotosModalActuales = [];
let indiceFotoModalActual = 0;
let touchStartX = 0;
let touchStartY = 0;
let historialModalActivo = false;
let historialCarritoActivo = false;
let detalleInicialAbierto = false;

// ======================== UTILIDADES GENERALES ========================

function leerJSONStorage(clave, defecto) {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? JSON.parse(raw) : defecto;
  } catch (e) {
    return defecto;
  }
}

function leerCuponesVerificados() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEYS.CUPONES_VERIFICADOS) || '[]');
  } catch (e) {
    return [];
  }
}

function guardarCuponesVerificados(lista) {
  try {
    sessionStorage.setItem(STORAGE_KEYS.CUPONES_VERIFICADOS, JSON.stringify(lista));
  } catch (e) {}
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatearBs(montoUSD) {
  if (!tasaBCV || tasaBCV <= 0) return 'Calculando...';
  return (montoUSD * tasaBCV).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' Bs.';
}

function vibrar() {
  if (navigator.vibrate) navigator.vibrate(25);
}

function trackEvent(eventName, params = {}) {
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
    if (typeof window.fbq === 'function') {
      const fbMap = {
        view_item: 'ViewContent',
        add_to_cart: 'AddToCart',
        begin_checkout: 'InitiateCheckout',
        sign_up: 'Lead'
      };
      if (fbMap[eventName]) window.fbq('track', fbMap[eventName], params);
    }
  } catch (e) {}
}

function guardarCarritoEnStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.CARRITO, JSON.stringify(carrito));
    if (carrito.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CARRITO_TS, Date.now().toString());
    } else {
      localStorage.removeItem(STORAGE_KEYS.CARRITO_TS);
    }
  } catch (e) {}
}

function guardarFavoritosEnStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITOS, JSON.stringify(favoritos));
  } catch (e) {}
  actualizarContadorFavoritos();
}

function normalizarTextoBusqueda(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .map(palabra => palabra.replace(/(es|s)$/, ''))
    .filter(Boolean);
}

function barajarProductos(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ======================== FAVORITOS ========================

function actualizarContadorFavoritos() {
  const el = document.getElementById('favCount');
  if (el) el.innerText = favoritos.length;
  const btn = document.getElementById('btnFavoritosHeader');
  if (btn) {
    if (soloFavoritos) {
      btn.classList.add('bg-rose-600/20', 'border-rose-500/60', 'text-rose-300');
      btn.classList.remove('bg-zinc-800', 'border-zinc-700', 'text-zinc-200');
    } else {
      btn.classList.remove('bg-rose-600/20', 'border-rose-500/60', 'text-rose-300');
      btn.classList.add('bg-zinc-800', 'border-zinc-700', 'text-zinc-200');
    }
  }
}

function toggleFavorito(id, btnEl = null) {
  vibrar();
  const idx = favoritos.indexOf(id);
  const agregado = idx === -1;
  if (agregado) {
    favoritos.push(id);
  } else {
    favoritos.splice(idx, 1);
  }
  guardarFavoritosEnStorage();

  if (btnEl) {
    const icon = btnEl.querySelector('i');
    if (icon) {
      icon.className = agregado
        ? 'fa-solid fa-heart text-rose-500 heart-pop text-xs'
        : 'fa-regular fa-heart text-zinc-300 text-xs';
    }
  }

  actualizarBotonFavoritoModal();
  if (soloFavoritos) {
    renderProductos(obtenerProductosFiltrados());
  }

  const prod = productos.find(p => p.id === id);
  if (prod) {
    mostrarToast(
      agregado ? `"${prod.nombre}" guardado en tus favoritos` : `"${prod.nombre}" quitado de favoritos`,
      agregado ? "Guardado en Favoritos" : "Favorito eliminado",
      true
    );
  }
}

function actualizarBotonFavoritoModal() {
  const btn = document.getElementById('btnFavoritoModal');
  if (!btn || !productoModalActual) return;
  const esFav = favoritos.includes(productoModalActual.id);
  btn.innerHTML = esFav
    ? `<i class="fa-solid fa-heart text-rose-500 heart-pop text-sm"></i>`
    : `<i class="fa-regular fa-heart text-sm"></i>`;
}

function toggleFavoritoModal() {
  if (!productoModalActual) return;
  toggleFavorito(productoModalActual.id);
  renderProductos(obtenerProductosFiltrados());
}

function toggleSoloFavoritos() {
  vibrar();
  soloFavoritos = !soloFavoritos;
  paginaActual = 1;
  actualizarContadorFavoritos();
  renderProductos(obtenerProductosFiltrados());
  if (soloFavoritos) {
    document.getElementById('barraCatalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function toggleSoloInmediata() {
  vibrar();
  soloInmediata = !soloInmediata;
  paginaActual = 1;
  const btn = document.getElementById('btnFiltroInmediata');
  if (btn) {
    if (soloInmediata) {
      btn.className = "bg-emerald-600/20 text-emerald-300 border border-emerald-500/60 rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shadow-md";
    } else {
      btn.className = "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap";
    }
  }
  renderProductos(obtenerProductosFiltrados());
}

function manejarInputBusqueda() {
  const input = document.getElementById('searchInput');
  const btn = document.getElementById('btnLimpiarBusqueda');
  if (btn && input) {
    btn.classList.toggle('hidden', input.value.trim().length === 0);
  }
  paginaActual = 1;
  filtrarProductos();
}

function limpiarBusqueda() {
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  manejarInputBusqueda();
}

function resetearTodosLosFiltros() {
  categoriaActual = 'todas';
  marcaActual = 'todas';
  tallaActual = 'todas';
  paginaActual = 1;
  soloInmediata = false;
  soloFavoritos = false;
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  const orden = document.getElementById('ordenSelect');
  if (orden) orden.value = 'destacados';
  const precio = document.getElementById('precioSelect');
  if (precio) precio.value = 'todos';
  document.getElementById('btnLimpiarBusqueda')?.classList.add('hidden');
  const btnInm = document.getElementById('btnFiltroInmediata');
  if (btnInm) {
    btnInm.className = "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap";
  }
  cerrarMenusDesplegables();
  actualizarContadorFavoritos();
  generarBotonesCategoriasDinamicos();
  generarMenuYBarraMarcas();
  generarMenuTallas();
  sincronizarFiltrosEnURL();
  renderProductos(obtenerProductosFiltrados());
}

function detectarMarca(item) {
  const marcaExplicita = (item.marca || '').trim();
  if (marcaExplicita) {
    return ALIAS_MARCAS[marcaExplicita.toLowerCase()] || marcaExplicita;
  }

  const texto = `${item.nombre || ''} ${item.descripcion || ''}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const m of MARCAS_CONOCIDAS) {
    const mNorm = m.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const esc = mNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${esc}(?:$|[^a-zA-Z0-9])`, 'i');
    if (regex.test(texto)) return ALIAS_MARCAS[m.toLowerCase()] || m;
  }
  return '';
}

function guardarDatosCliente() {
  try {
    const datos = {
      nombre: document.getElementById('nombreCliente')?.value.trim() || '',
      telefono: document.getElementById('telefonoCliente')?.value.trim() || '',
      agencia: document.getElementById('empresaEnvio')?.value || '',
      metodoPago: document.getElementById('metodoPago')?.value || '',
      direccion: document.getElementById('direccionEnvio')?.value.trim() || ''
    };
    localStorage.setItem(STORAGE_KEYS.CLIENTE, JSON.stringify(datos));
  } catch (e) {}
}

function cargarDatosClienteGuardados() {
  const datos = leerJSONStorage(STORAGE_KEYS.CLIENTE, null);
  if (!datos) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  };
  setVal('nombreCliente', datos.nombre);
  setVal('telefonoCliente', datos.telefono);
  setVal('direccionEnvio', datos.direccion);
  if (datos.agencia) {
    const sel = document.getElementById('empresaEnvio');
    if (sel && Array.from(sel.options).some(o => o.value === datos.agencia)) {
      sel.value = datos.agencia;
      actualizarCostoEnvio();
    }
  }
  if (datos.metodoPago) {
    const selPago = document.getElementById('metodoPago');
    if (selPago && Array.from(selPago.options).some(o => o.value === datos.metodoPago)) {
      selPago.value = datos.metodoPago;
      mostrarDatosPago();
    }
  }
}

// ======================== CATÁLOGO GOOGLE SHEETS + CACHÉ INSTANTÁNEA ========================

function actualizarEstadoSync(tipo, texto) {
  const el = document.getElementById('estadoSync');
  if (!el) return;
  if (tipo === 'cargando') {
    el.className = "inline-flex items-center gap-1.5 text-zinc-500";
    el.innerHTML = `<i class="fa-solid fa-rotate fa-spin text-[10px] text-orange-400"></i> ${escapeHTML(texto)}`;
  } else if (tipo === 'ok') {
    el.className = "inline-flex items-center gap-1.5 text-emerald-400/90";
    el.innerHTML = `<i class="fa-solid fa-circle-check text-[10px]"></i> ${escapeHTML(texto)}`;
  } else {
    el.className = "inline-flex items-center gap-1.5 text-amber-400";
    el.innerHTML = `<i class="fa-solid fa-wifi text-[10px]"></i> ${escapeHTML(texto)}`;
  }
}

function cargarCatalogoDesdeCache() {
  const cache = leerJSONStorage(STORAGE_KEYS.CATALOGO, null);
  if (cache && Array.isArray(cache.productos) && cache.productos.length > 0) {
    productos = cache.productos.map(p => ({ ...p, marca: p.marca || detectarMarca(p) }));
    aplicarFiltrosDesdeURL();
    generarBotonesCategoriasDinamicos();
    generarMenuYBarraMarcas();
    generarMenuTallas();
    renderCarruselOfertas();
    renderProductos(obtenerProductosFiltrados());
    abrirProductoDesdeURLSiAplica();
    actualizarEstadoSync('cargando', 'Actualizando precios y stock...');
  }
}

function cargarCatalogoDesdeHoja() {
  const callbackName = "manejarRespuestaGoogleSheets";
  const scriptUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&gid=${GID_CATALOGO_WEB}&_t=${Date.now()}`;

  clearTimeout(timerEsperaJSONP);
  timerEsperaJSONP = setTimeout(() => {
    const container = document.getElementById('gridProductos');
    if (productos && productos.length > 0) {
      actualizarEstadoSync('warn', 'Mostrando catálogo guardado');
      return;
    }
    if (container) {
      container.innerHTML = `
        <div class="col-span-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center space-y-3">
          <i class="fa-solid fa-triangle-exclamation text-amber-400 text-3xl"></i>
          <h3 class="text-white font-bold">Aviso de Sincronización</h3>
          <p class="text-rose-400 font-mono text-xs max-w-lg mx-auto bg-black/50 p-2.5 rounded-lg border border-rose-900/40">
            Google Sheets tardó en responder. Verifica tu conexión a internet.
          </p>
          <button onclick="cargarCatalogoDesdeHoja()" class="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer">
            Reintentar ahora
          </button>
        </div>
      `;
    }
  }, 10000);

  const prev = document.getElementById('jsonp-sheets');
  if (prev) prev.remove();

  const script = document.createElement('script');
  script.src = scriptUrl;
  script.id = 'jsonp-sheets';
  script.onerror = () => {
    if (productos.length > 0) {
      actualizarEstadoSync('warn', 'Sin conexión · Catálogo en caché');
    }
  };
  document.body.appendChild(script);
}

window.manejarRespuestaGoogleSheets = function(data) {
  clearTimeout(timerEsperaJSONP);

  try {
    if (!data || !data.table || !data.table.rows) return;

    const cabeceras = data.table.cols.map(c => (c.label || '').trim().toLowerCase().replace(/\s+/g, '_'));
    const filas = data.table.rows;

    const nuevosProductos = filas
      .map(r => {
        const obj = {};
        (r.c || []).forEach((celda, idx) => {
          const cab = cabeceras[idx] || `col_${idx}`;
          obj[cab] = celda && celda.v !== null && celda.v !== undefined ? String(celda.v) : '';
        });
        return obj;
      })
      .filter(f => {
        const val = (f.activo || '').trim().toUpperCase();
        return val === 'TRUE' || val === 'VERDADERO' || val === 'SI' || val === '1';
      })
      .map(f => {
        const mapaTallas = {};
        let stockTotal = 0;
        const campoStock = f.stock_tallas || "";

        if (campoStock.includes(':')) {
          campoStock.split(',').forEach(par => {
            const [t, cant] = par.split(':');
            if (t && cant !== undefined) {
              const qty = parseInt(cant.trim(), 10) || 0;
              mapaTallas[t.trim().toUpperCase()] = qty;
              stockTotal += qty;
            }
          });
        } else {
          stockTotal = parseInt(campoStock.trim(), 10) || 0;
        }

        const galeriaFotos = [f.foto_1, f.foto_2, f.foto_3, f.foto_4]
          .map(u => (u || '').trim())
          .filter(url => url.length > 0);
        const ficha = f.ficha_tecnica ? f.ficha_tecnica.split('|').map(item => item.trim()).filter(Boolean) : [];
        const precioLimpio = (f.preciousd || f.precio || '0').replace(/[^0-9.,]/g, '').replace(',', '.');
        const precioAnteriorLimpio = (f.precio_anterior || '0').replace(/[^0-9.,]/g, '').replace(',', '.');

        const precioActualNum = parseFloat(precioLimpio) || 0;
        const precioAnteriorNum = parseFloat(precioAnteriorLimpio) || 0;
        const catLimpia = (f.categoria || "otros").trim().toLowerCase();

        return {
          id: (f.id || '').trim(),
          nombre: (f.nombre || 'Sin nombre').trim(),
          categoria: catLimpia,
          marca: detectarMarca(f),
          precioUSD: precioActualNum,
          precioAnteriorUSD: precioAnteriorNum > precioActualNum ? precioAnteriorNum : 0,
          mapaTallas,
          tieneTallas: Object.keys(mapaTallas).length > 0,
          stockTotal,
          imagen: galeriaFotos[0] || IMAGEN_RESPALDO,
          galeriaFotos,
          videoURL: f.video_url ? f.video_url.trim() : null,
          descripcion: (f.descripcion || '').trim(),
          fichaTecnica: ficha
        };
      });

    productos = barajarProductos(nuevosProductos);

    try {
      localStorage.setItem(STORAGE_KEYS.CATALOGO, JSON.stringify({
        updatedAt: Date.now(),
        productos
      }));
    } catch (e) {}

    aplicarFiltrosDesdeURL();
    generarBotonesCategoriasDinamicos();
    generarMenuYBarraMarcas();
    generarMenuTallas();
    renderCarruselOfertas();
    renderProductos(obtenerProductosFiltrados());
    verificarYNotificarOfertasNuevas(productos);
    actualizarEstadoSync('ok', 'Catálogo actualizado');
    abrirProductoDesdeURLSiAplica();
  } catch (err) {
    console.error("Error interpretando datos:", err);
    actualizarEstadoSync('warn', 'Error leyendo catálogo');
  }
};

function abrirProductoDesdeURLSiAplica() {
  if (detalleInicialAbierto || !productos.length) return;
  const params = new URLSearchParams(window.location.search);
  const idUrl = params.get('id');
  if (idUrl) {
    const encontrado = productos.find(p => p.id.toLowerCase() === idUrl.trim().toLowerCase());
    if (encontrado) {
      detalleInicialAbierto = true;
      abrirDetalleProducto(encontrado.id, false);
    }
  }
}

function verificarYNotificarOfertasNuevas(listaProductos) {
  const ofertasActivas = listaProductos.filter(p => p.precioAnteriorUSD > p.precioUSD);
  if (ofertasActivas.length === 0) return;

  const idsVistos = leerJSONStorage(STORAGE_KEYS.OFERTAS_VISTAS, []);
  const nuevasOfertas = ofertasActivas.filter(p => !idsVistos.includes(p.id));

  if (nuevasOfertas.length > 0) {
    const ofertaDestacada = nuevasOfertas[0];
    try {
      localStorage.setItem(STORAGE_KEYS.OFERTAS_VISTAS, JSON.stringify(ofertasActivas.map(p => p.id)));
    } catch (e) {}

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("🔥 ¡Nueva Oferta en Maviko!", {
          body: `${ofertaDestacada.nombre} ahora en $${ofertaDestacada.precioUSD.toFixed(2)} (Antes $${ofertaDestacada.precioAnteriorUSD.toFixed(2)})`,
          icon: "./icon-192.png"
        });
      } catch (e) {}
    }
    mostrarToast(`🔥 Oferta: ${ofertaDestacada.nombre} en $${ofertaDestacada.precioUSD.toFixed(2)}`, "¡Nueva Rebaja Disponible!", true);
  }
}

// ======================== FILTROS, DESPLEGABLES, MARCAS Y PAGINACIÓN ========================

function cerrarMenusDesplegables() {
  document.getElementById('panelCategorias')?.classList.add('hidden');
  document.getElementById('panelMarcas')?.classList.add('hidden');
  document.getElementById('panelTallas')?.classList.add('hidden');
  document.getElementById('chevronCategorias')?.classList.remove('rotate-180');
  document.getElementById('chevronMarcas')?.classList.remove('rotate-180');
  document.getElementById('chevronTallas')?.classList.remove('rotate-180');
}

function toggleMenuCategorias() {
  vibrar();
  const panel = document.getElementById('panelCategorias');
  const estabaOculto = panel?.classList.contains('hidden');
  cerrarMenusDesplegables();
  if (estabaOculto && panel) {
    panel.classList.remove('hidden');
    document.getElementById('chevronCategorias')?.classList.add('rotate-180');
  }
}

function toggleMenuMarcas() {
  vibrar();
  const panel = document.getElementById('panelMarcas');
  const estabaOculto = panel?.classList.contains('hidden');
  cerrarMenusDesplegables();
  if (estabaOculto && panel) {
    panel.classList.remove('hidden');
    document.getElementById('chevronMarcas')?.classList.add('rotate-180');
  }
}

function toggleMenuTallas() {
  vibrar();
  const panel = document.getElementById('panelTallas');
  const estabaOculto = panel?.classList.contains('hidden');
  cerrarMenusDesplegables();
  if (estabaOculto && panel) {
    panel.classList.remove('hidden');
    document.getElementById('chevronTallas')?.classList.add('rotate-180');
  }
}

function generarMenuTallas() {
  const dropdown = document.getElementById('dropdownTallas');
  const panelContenedor = document.getElementById('contenedorTallasPanel');
  const labelActiva = document.getElementById('labelTallaActiva');
  const btnMenu = document.getElementById('btnMenuTallas');

  const conteoTallas = new Map();
  productos.forEach(p => {
    if (!p.tieneTallas || !p.mapaTallas) return;
    Object.entries(p.mapaTallas).forEach(([talla, qty]) => {
      if (qty > 0) {
        conteoTallas.set(talla, (conteoTallas.get(talla) || 0) + 1);
      }
    });
  });

  const ordenRopa = { XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6, XXXL: 7 };
  const tallasOrdenadas = [...conteoTallas.entries()].sort((a, b) => {
    const na = parseFloat(a[0]);
    const nb = parseFloat(b[0]);
    const aNum = !Number.isNaN(na) && /^\d/.test(a[0]);
    const bNum = !Number.isNaN(nb) && /^\d/.test(b[0]);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    const ra = ordenRopa[a[0]] || 99;
    const rb = ordenRopa[b[0]] || 99;
    if (ra !== rb) return ra - rb;
    return a[0].localeCompare(b[0]);
  });

  if (tallasOrdenadas.length === 0) {
    dropdown?.classList.add('hidden');
    return;
  }

  dropdown?.classList.remove('hidden');

  if (panelContenedor) {
    panelContenedor.innerHTML = '';
    const crearBtnTalla = (key, etiqueta, count, activo) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.talla = key;
      btn.className = `${activo ? 'bg-sky-500 text-black font-extrabold border-sky-400 shadow-md' : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border-zinc-800'} px-2 py-2 rounded-xl text-xs transition-all cursor-pointer border flex flex-col items-center justify-center leading-tight`;
      btn.innerHTML = `<span>${escapeHTML(etiqueta)}</span><span class="text-[9px] ${activo ? 'text-black/75 font-bold' : 'text-zinc-500'}">${count} disp.</span>`;
      return btn;
    };

    tallasOrdenadas.forEach(([talla, count]) => {
      panelContenedor.appendChild(crearBtnTalla(talla, talla, count, tallaActual === talla));
    });
  }

  if (labelActiva) {
    labelActiva.textContent = tallaActual === 'todas' ? 'Tallas' : `Talla: ${tallaActual}`;
  }
  if (btnMenu) {
    btnMenu.classList.toggle('border-sky-500/70', tallaActual !== 'todas');
    btnMenu.classList.toggle('bg-sky-500/15', tallaActual !== 'todas');
  }
}

function filtrarTalla(talla) {
  vibrar();
  tallaActual = (tallaActual === talla && talla !== 'todas') ? 'todas' : talla;
  paginaActual = 1;
  cerrarMenusDesplegables();
  generarMenuTallas();
  sincronizarFiltrosEnURL();
  renderProductos(obtenerProductosFiltrados());
}

function renderCarruselOfertas() {
  const seccion = document.getElementById('seccionOfertasFlash');
  const carrusel = document.getElementById('carruselOfertas');
  if (!seccion || !carrusel) return;

  const ofertas = productos
    .filter(p => p.precioAnteriorUSD > p.precioUSD)
    .sort((a, b) => ((b.precioAnteriorUSD - b.precioUSD) / b.precioAnteriorUSD) - ((a.precioAnteriorUSD - a.precioUSD) / a.precioAnteriorUSD))
    .slice(0, 10);

  if (ofertas.length === 0) {
    seccion.classList.add('hidden');
    carrusel.innerHTML = '';
    return;
  }

  seccion.classList.remove('hidden');
  carrusel.innerHTML = ofertas.map(p => {
    const pct = Math.round(((p.precioAnteriorUSD - p.precioUSD) / p.precioAnteriorUSD) * 100);
    return `
      <button type="button" data-action="detalle" data-id="${escapeHTML(p.id)}" class="snap-start shrink-0 w-44 sm:w-48 bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 rounded-2xl p-2.5 text-left transition-all cursor-pointer flex flex-col justify-between gap-2 group">
        <div class="h-28 rounded-xl bg-zinc-950 relative flex items-center justify-center p-2 overflow-hidden">
          <img src="${escapeHTML(p.imagen || IMAGEN_RESPALDO)}" alt="${escapeHTML(p.nombre)}" loading="lazy" onerror="this.src='${IMAGEN_RESPALDO}'" class="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300">
          <span class="absolute top-1.5 left-1.5 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">-${pct}%</span>
        </div>
        <div class="space-y-0.5">
          <p class="text-[11px] font-bold text-white line-clamp-1">${escapeHTML(p.nombre)}</p>
          <div class="flex items-baseline gap-1.5">
            <span class="text-xs font-extrabold text-orange-400">$${p.precioUSD.toFixed(2)}</span>
            <span class="text-[10px] text-zinc-500 line-through">$${p.precioAnteriorUSD.toFixed(2)}</span>
          </div>
        </div>
      </button>
    `;
  }).join('');
}

function verSoloOfertas() {
  vibrar();
  const sel = document.getElementById('ordenSelect');
  if (sel) sel.value = 'ofertas';
  paginaActual = 1;
  sincronizarFiltrosEnURL();
  renderProductos(obtenerProductosFiltrados());
  document.getElementById('barraCatalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sincronizarFiltrosEnURL() {
  try {
    const url = new URL(window.location.href);
    if (categoriaActual !== 'todas') url.searchParams.set('categoria', categoriaActual);
    else url.searchParams.delete('categoria');

    if (marcaActual !== 'todas') url.searchParams.set('marca', marcaActual);
    else url.searchParams.delete('marca');

    if (tallaActual !== 'todas') url.searchParams.set('talla', tallaActual);
    else url.searchParams.delete('talla');

    const orden = document.getElementById('ordenSelect')?.value || 'destacados';
    if (orden === 'ofertas') url.searchParams.set('filtro', 'ofertas');
    else if (soloInmediata) url.searchParams.set('filtro', 'inmediata');
    else url.searchParams.delete('filtro');

    history.replaceState({}, '', url.toString());
  } catch (e) {}
}

function aplicarFiltrosDesdeURL() {
  if (filtrosURLAplicados || !productos.length) return;
  filtrosURLAplicados = true;

  const params = new URLSearchParams(window.location.search);
  const catParam = params.get('categoria');
  const marcaParam = params.get('marca');
  const tallaParam = params.get('talla');

  if (catParam) {
    const catBuscada = catParam.trim().toLowerCase();
    const matchCat = productos.find(p => p.categoria === catBuscada);
    if (matchCat) categoriaActual = matchCat.categoria;
  }

  if (marcaParam) {
    const marcaBuscada = marcaParam.trim().toLowerCase();
    const matchMarca = productos.find(p => (p.marca || '').toLowerCase() === marcaBuscada);
    if (matchMarca) marcaActual = matchMarca.marca;
  }

  if (tallaParam) {
    const tallaBuscada = tallaParam.trim().toUpperCase();
    const matchTalla = productos.find(p => p.tieneTallas && p.mapaTallas && p.mapaTallas[tallaBuscada] > 0);
    if (matchTalla) tallaActual = tallaBuscada;
  }
}

async function compartirEnlaceFiltro() {
  vibrar();
  sincronizarFiltrosEnURL();
  const url = window.location.href;
  const partes = [];
  if (marcaActual !== 'todas') partes.push(marcaActual);
  if (categoriaActual !== 'todas') partes.push(categoriaActual);
  if (tallaActual !== 'todas') partes.push(`Talla ${tallaActual}`);
  const titulo = partes.length > 0 ? `Maviko — ${partes.join(' · ')}` : 'Maviko | Tienda Oficial';

  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: `Mira esta selección disponible en Maviko:`, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    mostrarToast("Enlace filtrado copiado. ¡Pégalo en tus historias de Instagram o WhatsApp!", "Enlace copiado", true);
  } catch (e) {
    mostrarToast(url, "Copia este enlace", true);
  }
}

function generarBotonesCategoriasDinamicos() {
  const contenedor = document.getElementById('contenedorFiltros');
  const labelActiva = document.getElementById('labelCategoriaActiva');
  const btnMenu = document.getElementById('btnMenuCategorias');
  if (!contenedor) return;

  const categoriasUnicas = [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort();
  contenedor.innerHTML = '';

  const crearBtn = (cat, nombre, count, activo) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.cat = cat;
    btn.className = `cat-btn ${activo ? 'bg-orange-600 text-white font-bold shadow-md border-orange-500' : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800'} px-3 py-2 rounded-xl text-xs transition-all cursor-pointer border flex items-center justify-between gap-2 text-left`;
    btn.innerHTML = `<span class="truncate">${escapeHTML(nombre)}</span><span class="text-[10px] px-1.5 py-0.5 rounded-md ${activo ? 'bg-black/25 text-white' : 'bg-zinc-900 text-zinc-400'}">${count}</span>`;
    return btn;
  };

  contenedor.appendChild(crearBtn('todas', 'Todas', productos.length, categoriaActual === 'todas'));

  categoriasUnicas.forEach(cat => {
    const count = productos.filter(p => p.categoria === cat).length;
    const nombreVisible = cat.charAt(0).toUpperCase() + cat.slice(1);
    contenedor.appendChild(crearBtn(cat, nombreVisible, count, categoriaActual === cat));
  });

  if (labelActiva) {
    if (categoriaActual === 'todas') {
      labelActiva.textContent = `Categorías (${productos.length})`;
    } else {
      const visible = categoriaActual.charAt(0).toUpperCase() + categoriaActual.slice(1);
      labelActiva.textContent = `Categoría: ${visible}`;
    }
  }
  if (btnMenu) {
    btnMenu.classList.toggle('border-orange-500/70', categoriaActual !== 'todas');
    btnMenu.classList.toggle('bg-orange-600/15', categoriaActual !== 'todas');
  }
}

function generarMenuYBarraMarcas() {
  const dropdown = document.getElementById('dropdownMarcas');
  const panelContenedor = document.getElementById('contenedorMarcasPanel');
  const seccionBarra = document.getElementById('seccionBarraMarcas');
  const barra = document.getElementById('barraMarcas');
  const labelActiva = document.getElementById('labelMarcaActiva');
  const btnMenu = document.getElementById('btnMenuMarcas');

  const conteoMarcas = new Map();
  productos.forEach(p => {
    const m = (p.marca || '').trim();
    if (!m) return;
    conteoMarcas.set(m, (conteoMarcas.get(m) || 0) + 1);
  });

  const marcasOrdenadas = [...conteoMarcas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (marcasOrdenadas.length === 0) {
    dropdown?.classList.add('hidden');
    seccionBarra?.classList.add('hidden');
    return;
  }

  dropdown?.classList.remove('hidden');
  seccionBarra?.classList.remove('hidden');

  if (panelContenedor) {
    panelContenedor.innerHTML = '';

    const crearItemPanel = (marcaKey, etiqueta, count, activo) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.marca = marcaKey;
      btn.className = `${activo ? 'bg-amber-500 text-black font-extrabold border-amber-400 shadow-md' : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border-zinc-800'} px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer border flex items-center justify-between gap-1.5 text-left`;
      btn.innerHTML = `<span class="truncate">${escapeHTML(etiqueta)}</span><span class="text-[10px] px-1.5 py-0.5 rounded-md ${activo ? 'bg-black/20 text-black font-bold' : 'bg-zinc-900 text-zinc-400'}">${count}</span>`;
      return btn;
    };

    panelContenedor.appendChild(crearItemPanel('todas', 'Todas', productos.length, marcaActual === 'todas'));
    marcasOrdenadas.forEach(([marca, count]) => {
      panelContenedor.appendChild(crearItemPanel(marca, marca, count, marcaActual === marca));
    });
  }

  if (barra) {
    barra.innerHTML = '';
    const btnTodas = document.createElement('button');
    btnTodas.type = 'button';
    btnTodas.dataset.marca = 'todas';
    btnTodas.className = `${marcaActual === 'todas' ? 'bg-amber-500 text-black font-extrabold border-amber-400' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'} px-3 py-1.5 rounded-full text-[11px] border transition-all cursor-pointer whitespace-nowrap`;
    btnTodas.textContent = 'Todas';
    barra.appendChild(btnTodas);

    marcasOrdenadas.slice(0, 14).forEach(([marca, count]) => {
      const activo = marcaActual === marca;
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.dataset.marca = marca;
      pill.className = `${activo ? 'bg-amber-500 text-black font-extrabold border-amber-400 shadow-md' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800'} px-3 py-1.5 rounded-full text-[11px] border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5`;
      pill.innerHTML = `<span>${escapeHTML(marca)}</span><span class="text-[10px] ${activo ? 'text-black/70' : 'text-zinc-500'}">${count}</span>`;
      barra.appendChild(pill);
    });
  }

  if (labelActiva) {
    labelActiva.textContent = marcaActual === 'todas' ? `Marcas (${marcasOrdenadas.length})` : `Marca: ${marcaActual}`;
  }
  if (btnMenu) {
    btnMenu.classList.toggle('border-amber-500/70', marcaActual !== 'todas');
    btnMenu.classList.toggle('bg-amber-500/15', marcaActual !== 'todas');
  }
}

function filtrarCategoria(cat) {
  vibrar();
  categoriaActual = cat;
  paginaActual = 1;
  cerrarMenusDesplegables();
  generarBotonesCategoriasDinamicos();
  sincronizarFiltrosEnURL();
  renderProductos(obtenerProductosFiltrados());
}

function filtrarMarca(marca) {
  vibrar();
  marcaActual = (marcaActual === marca && marca !== 'todas') ? 'todas' : marca;
  paginaActual = 1;
  cerrarMenusDesplegables();
  generarMenuYBarraMarcas();
  sincronizarFiltrosEnURL();
  renderProductos(obtenerProductosFiltrados());
}

function limpiarFiltroPrecio() {
  const sel = document.getElementById('precioSelect');
  if (sel) sel.value = 'todos';
  filtrarProductos();
}

function renderFiltrosActivos() {
  const bar = document.getElementById('filtrosActivosBar');
  if (!bar) return;

  const precioVal = document.getElementById('precioSelect')?.value || 'todos';
  const etiquetasPrecio = {
    '0-30': 'Hasta $30',
    '30-60': '$30 – $60',
    '60-100': '$60 – $100',
    '100+': 'Más de $100'
  };

  const chips = [];
  if (categoriaActual !== 'todas') {
    const visible = categoriaActual.charAt(0).toUpperCase() + categoriaActual.slice(1);
    chips.push(`<button type="button" onclick="filtrarCategoria('todas')" class="bg-orange-500/15 text-orange-300 border border-orange-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-orange-500/25"><span>${escapeHTML(visible)}</span><i class="fa-solid fa-xmark"></i></button>`);
  }
  if (marcaActual !== 'todas') {
    chips.push(`<button type="button" onclick="filtrarMarca('todas')" class="bg-amber-500/15 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-500/25"><span>${escapeHTML(marcaActual)}</span><i class="fa-solid fa-xmark"></i></button>`);
  }
  if (tallaActual !== 'todas') {
    chips.push(`<button type="button" onclick="filtrarTalla('todas')" class="bg-sky-500/15 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-sky-500/25"><span>Talla ${escapeHTML(tallaActual)}</span><i class="fa-solid fa-xmark"></i></button>`);
  }
  if (precioVal !== 'todos' && etiquetasPrecio[precioVal]) {
    chips.push(`<button type="button" onclick="limpiarFiltroPrecio()" class="bg-purple-500/15 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-purple-500/25"><span>${etiquetasPrecio[precioVal]}</span><i class="fa-solid fa-xmark"></i></button>`);
  }
  if (soloInmediata) {
    chips.push(`<button type="button" onclick="toggleSoloInmediata()" class="bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-500/25"><span>⚡ Inmediata</span><i class="fa-solid fa-xmark"></i></button>`);
  }
  if (soloFavoritos) {
    chips.push(`<button type="button" onclick="toggleSoloFavoritos()" class="bg-rose-500/15 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-500/25"><span>❤️ Favoritos</span><i class="fa-solid fa-xmark"></i></button>`);
  }

  if (chips.length > 0) {
    chips.push(`<button type="button" onclick="compartirEnlaceFiltro()" class="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer" title="Copiar enlace directo de esta selección"><i class="fa-solid fa-share-nodes text-orange-400"></i> Compartir enlace</button>`);
    chips.push(`<button type="button" onclick="resetearTodosLosFiltros()" class="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer ml-1">Limpiar</button>`);
    bar.innerHTML = chips.join('');
    bar.classList.remove('hidden');
  } else {
    bar.innerHTML = '';
    bar.classList.add('hidden');
  }
}

function filtrarProductos() {
  paginaActual = 1;
  sincronizarFiltrosEnURL();
  renderProductos(obtenerProductosFiltrados());
}

function obtenerProductosFiltrados() {
  const textoRaw = (document.getElementById('searchInput')?.value || '').trim();
  const tokensBusqueda = normalizarTextoBusqueda(textoRaw);
  const orden = document.getElementById('ordenSelect')?.value || 'destacados';
  const rangoPrecio = document.getElementById('precioSelect')?.value || 'todos';

  let filtrados = productos.filter(p => {
    const coincideCat = categoriaActual === 'todas' || p.categoria === categoriaActual;
    const coincideMarca = marcaActual === 'todas' || (p.marca || '').toLowerCase() === marcaActual.toLowerCase();
    const coincideTalla = tallaActual === 'todas' || (p.tieneTallas && p.mapaTallas && p.mapaTallas[tallaActual] > 0);
    const textoProducto = `${p.nombre} ${p.categoria} ${p.marca || ''} ${p.id} ${p.descripcion}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const coincideBusqueda = tokensBusqueda.length === 0 || tokensBusqueda.every(tok => textoProducto.includes(tok));
    const coincideOferta = orden !== 'ofertas' || p.precioAnteriorUSD > 0;
    const coincideInmediata = !soloInmediata || p.stockTotal > 0;
    const coincideFav = !soloFavoritos || favoritos.includes(p.id);

    let coincidePrecio = true;
    if (rangoPrecio === '0-30') coincidePrecio = p.precioUSD <= 30;
    else if (rangoPrecio === '30-60') coincidePrecio = p.precioUSD > 30 && p.precioUSD <= 60;
    else if (rangoPrecio === '60-100') coincidePrecio = p.precioUSD > 60 && p.precioUSD <= 100;
    else if (rangoPrecio === '100+') coincidePrecio = p.precioUSD > 100;

    return coincideCat && coincideMarca && coincideTalla && coincidePrecio && coincideBusqueda && coincideOferta && coincideInmediata && coincideFav;
  });

  if (orden === 'menor-precio') {
    filtrados.sort((a, b) => a.precioUSD - b.precioUSD);
  } else if (orden === 'mayor-precio') {
    filtrados.sort((a, b) => b.precioUSD - a.precioUSD);
  }

  return filtrados;
}

function irAPagina(num) {
  vibrar();
  paginaActual = num;
  renderProductos(obtenerProductosFiltrados());
  document.getElementById('barraCatalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPaginacion(totalItems, totalPaginas) {
  const nav = document.getElementById('paginacionCatalogo');
  if (!nav) return;

  if (totalPaginas <= 1) {
    nav.innerHTML = '';
    nav.classList.add('hidden');
    return;
  }

  nav.classList.remove('hidden');

  const inicio = (paginaActual - 1) * PRODUCTOS_POR_PAGINA + 1;
  const fin = Math.min(totalItems, paginaActual * PRODUCTOS_POR_PAGINA);

  // Construir botones de página inteligentes (con puntos suspensivos)
  const paginas = [];
  if (totalPaginas <= 7) {
    for (let i = 1; i <= totalPaginas; i++) paginas.push(i);
  } else {
    paginas.push(1);
    if (paginaActual > 3) paginas.push('...');
    const desde = Math.max(2, paginaActual - 1);
    const hasta = Math.min(totalPaginas - 1, paginaActual + 1);
    for (let i = desde; i <= hasta; i++) paginas.push(i);
    if (paginaActual < totalPaginas - 2) paginas.push('...');
    paginas.push(totalPaginas);
  }

  const botonesPaginas = paginas.map(p => {
    if (p === '...') {
      return `<span class="px-2 text-zinc-500 text-xs select-none">…</span>`;
    }
    const activo = p === paginaActual;
    return `
      <button type="button" data-page="${p}" ${activo ? 'aria-current="page"' : ''} class="min-w-[36px] h-9 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${activo ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/25' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800'}">
        ${p}
      </button>
    `;
  }).join('');

  nav.innerHTML = `
    <div class="flex flex-wrap items-center justify-center gap-1.5">
      <button type="button" data-page="${paginaActual - 1}" ${paginaActual <= 1 ? 'disabled' : ''} class="h-9 px-3 rounded-xl text-xs font-bold border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-all">
        <i class="fa-solid fa-chevron-left text-[10px]"></i> <span class="hidden sm:inline">Anterior</span>
      </button>
      ${botonesPaginas}
      <button type="button" data-page="${paginaActual + 1}" ${paginaActual >= totalPaginas ? 'disabled' : ''} class="h-9 px-3 rounded-xl text-xs font-bold border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-all">
        <span class="hidden sm:inline">Siguiente</span> <i class="fa-solid fa-chevron-right text-[10px]"></i>
      </button>
    </div>
    <p class="text-[11px] text-zinc-500">
      Hoja <strong class="text-zinc-300">${paginaActual}</strong> de <strong class="text-zinc-300">${totalPaginas}</strong> · Mostrando ${inicio}–${fin} de ${totalItems} artículos
    </p>
  `;
}

function renderProductos(lista) {
  const container = document.getElementById('gridProductos');
  const contador = document.getElementById('contadorResultados');
  if (!container) return;

  renderFiltrosActivos();

  const totalPaginas = Math.max(1, Math.ceil(lista.length / PRODUCTOS_POR_PAGINA));
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;
  if (paginaActual < 1) paginaActual = 1;

  const inicioIdx = (paginaActual - 1) * PRODUCTOS_POR_PAGINA;
  const paginaItems = lista.slice(inicioIdx, inicioIdx + PRODUCTOS_POR_PAGINA);

  if (contador) {
    if (productos.length === 0) {
      contador.textContent = 'Cargando catálogo...';
    } else if (lista.length === 0) {
      contador.textContent = '0 artículos encontrados';
    } else if (totalPaginas > 1) {
      contador.textContent = `Mostrando ${inicioIdx + 1}–${inicioIdx + paginaItems.length} de ${lista.length} artículos`;
    } else if (lista.length === productos.length) {
      contador.textContent = `Mostrando ${lista.length} artículos disponibles`;
    } else {
      contador.textContent = `Mostrando ${lista.length} de ${productos.length} artículos`;
    }
  }

  container.innerHTML = '';

  if (lista.length === 0) {
    renderPaginacion(0, 0);
    container.innerHTML = `
      <div class="col-span-full bg-zinc-900/60 border border-zinc-800 rounded-2xl text-center py-14 px-4 space-y-3">
        <i class="fa-solid fa-magnifying-glass text-zinc-600 text-2xl"></i>
        <p class="text-zinc-300 font-semibold text-sm">${soloFavoritos ? 'Aún no tienes artículos en tus favoritos.' : 'No se encontraron artículos con esos filtros.'}</p>
        <button onclick="resetearTodosLosFiltros()" class="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-colors">
          Ver todo el catálogo
        </button>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  paginaItems.forEach(p => {
    const precioBsTexto = formatearBs(p.precioUSD);
    const esFav = favoritos.includes(p.id);
    const safeId = escapeHTML(p.id);
    const safeNombre = escapeHTML(p.nombre);
    const safeCat = escapeHTML(p.categoria);
    const safeDesc = escapeHTML(p.descripcion);
    const safeImg = escapeHTML(p.imagen || IMAGEN_RESPALDO);

    const card = document.createElement('article');
    card.className = "product-card bg-zinc-900 border border-zinc-800 rounded-2xl p-2.5 sm:p-4 shadow-lg hover:border-orange-500/50 flex flex-col justify-between group";

    let stockTag = '';
    if (p.stockTotal <= 0) {
      stockTag = `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">Encargo</span>`;
    } else if (p.stockTotal <= 3) {
      stockTag = `<span class="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full animate-pulse">Últ. ${p.stockTotal}</span>`;
    } else {
      stockTag = `<span class="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">⚡ Stock</span>`;
    }

    let descuentoBadge = '';
    let precioAnteriorHTML = '';
    if (p.precioAnteriorUSD > 0) {
      const pct = Math.round(((p.precioAnteriorUSD - p.precioUSD) / p.precioAnteriorUSD) * 100);
      descuentoBadge = `<span class="bg-rose-600 text-white text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full shadow">-${pct}%</span>`;
      precioAnteriorHTML = `<span class="text-[10px] sm:text-xs text-zinc-500 line-through mr-1">$${p.precioAnteriorUSD.toFixed(2)}</span>`;
    }

    const tallasDisponibles = p.tieneTallas ? Object.keys(p.mapaTallas).filter(t => p.mapaTallas[t] > 0) : [];
    const textoTallas = p.tieneTallas
      ? `<p class="text-[10px] sm:text-[11px] text-orange-400 font-semibold mb-1.5 line-clamp-1">Tallas: ${escapeHTML(tallasDisponibles.length > 0 ? tallasDisponibles.join(', ') : 'Encargo')}</p>`
      : '';

    card.innerHTML = `
      <div>
        <div class="h-36 sm:h-48 rounded-xl bg-zinc-950 overflow-hidden mb-2 sm:mb-3 relative cursor-pointer flex items-center justify-center p-1.5 sm:p-2" data-action="detalle" data-id="${safeId}">
          <img src="${safeImg}" alt="${safeNombre}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${IMAGEN_RESPALDO}';" class="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300">

          <div class="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex flex-col gap-1 z-10">
            <button type="button" data-action="favorito" data-id="${safeId}" class="w-7 h-7 rounded-full bg-black/75 hover:bg-black border border-zinc-700 flex items-center justify-center cursor-pointer transition-colors" title="Guardar en favoritos" aria-label="Guardar en favoritos">
              <i class="${esFav ? 'fa-solid fa-heart text-rose-500' : 'fa-regular fa-heart text-zinc-300'} text-xs pointer-events-none"></i>
            </button>
            ${descuentoBadge}
          </div>

          <div class="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex flex-col items-end gap-1 pointer-events-none">
            <span class="hidden sm:inline-block bg-black/80 backdrop-blur-md text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border border-orange-500/30">${safeCat}</span>
            ${stockTag}
          </div>

          ${p.videoURL ? `<span class="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 bg-black/80 text-white text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md flex items-center gap-1 border border-zinc-700 pointer-events-none"><i class="fa-solid fa-circle-play text-orange-400"></i> Video</span>` : ''}

          <div class="hidden sm:flex absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center pointer-events-none">
            <span class="bg-black/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg border border-orange-500/50 shadow-md">Ver detalles</span>
          </div>
        </div>

        <h3 class="font-bold text-white mb-1 text-xs sm:text-sm cursor-pointer hover:text-orange-400 transition-colors line-clamp-2 sm:line-clamp-1 leading-snug" data-action="detalle" data-id="${safeId}">${safeNombre}</h3>
        ${textoTallas}
        <p class="hidden sm:line-clamp-2 text-xs text-zinc-400 mb-3">${safeDesc}</p>
      </div>
      <div>
        <div class="flex items-baseline gap-1 mb-2 sm:mb-3 flex-wrap leading-tight">
          ${precioAnteriorHTML}
          <span class="text-base sm:text-lg font-extrabold text-orange-400">$${p.precioUSD.toFixed(2)}</span>
          <span class="text-[10px] sm:text-xs text-zinc-500">/ ${escapeHTML(precioBsTexto)}</span>
        </div>
        <div class="flex gap-1.5 sm:gap-2">
          <button type="button" data-action="detalle" data-id="${safeId}" class="hidden sm:flex bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer items-center justify-center" title="Ver más detalles" aria-label="Ver detalles">
            <i class="fa-solid fa-eye pointer-events-none"></i>
          </button>
          <button type="button" data-action="agregar" data-id="${safeId}" class="flex-grow ${p.stockTotal <= 0 ? 'bg-amber-600 hover:bg-amber-500' : 'bg-orange-600 hover:bg-orange-500'} text-white cursor-pointer shadow-md font-bold py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs transition-colors flex items-center justify-center gap-1.5 sm:gap-2">
            <i class="fa-solid ${p.stockTotal <= 0 ? 'fa-clock' : 'fa-plus'} pointer-events-none"></i> ${p.stockTotal <= 0 ? 'Encargar' : 'Agregar'}
          </button>
        </div>
      </div>
    `;

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
  renderPaginacion(lista.length, totalPaginas);
}

// ======================== TASA BCV (CON RESPALDO Y RE-RENDER) ========================

async function obtenerTasaBCV() {
  const displayEl = document.getElementById('displayTasa');
  if (tasaBCV > 0 && displayEl) {
    displayEl.innerText = tasaBCV.toFixed(2);
  }

  let nuevaTasa = null;

  // Fuente 1: rates.dolarvzla.com
  try {
    const resp = await fetch('https://rates.dolarvzla.com/bcv/current.json', { cache: 'no-store' });
    if (resp.ok) {
      const datos = await resp.json();
      const val = parseFloat(datos?.current?.usd);
      if (val && val > 10) nuevaTasa = val;
    }
  } catch (e) {}

  // Fuente 2 (Respaldo): ve.dolarapi.com
  if (!nuevaTasa) {
    try {
      const resp2 = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
      if (resp2.ok) {
        const datos2 = await resp2.json();
        const val2 = parseFloat(datos2?.promedio);
        if (val2 && val2 > 10) nuevaTasa = val2;
      }
    } catch (e) {}
  }

  if (nuevaTasa) {
    const cambio = Math.abs(nuevaTasa - tasaBCV) > 0.001;
    tasaBCV = nuevaTasa;
    try {
      localStorage.setItem(STORAGE_KEYS.TASA_BCV, tasaBCV.toFixed(2));
    } catch (e) {}

    if (displayEl) displayEl.innerText = tasaBCV.toFixed(2);
    actualizarCarritoUI();

    // Re-renderizar tarjetas y modal si el catálogo ya estaba cargado para mostrar Bs exactos
    if (cambio && productos.length > 0) {
      renderProductos(obtenerProductosFiltrados());
    }
    if (productoModalActual) {
      const modalBs = document.getElementById('precioModalBS');
      if (modalBs) modalBs.innerText = `/ ${formatearBs(productoModalActual.precioUSD)}`;
      const footerBs = document.getElementById('precioModalFooterBS');
      if (footerBs) footerBs.innerText = formatearBs(productoModalActual.precioUSD);
    }
  } else if (displayEl) {
    displayEl.innerText = tasaBCV > 0 ? tasaBCV.toFixed(2) : 'Consultar';
  }
}

function iniciarContadorBCV() {
  function actualizarTimer() {
    const ahora = new Date();
    const objetivo = new Date();
    objetivo.setHours(17, 0, 0, 0);
    if (ahora >= objetivo) objetivo.setDate(objetivo.getDate() + 1);

    const diferencia = objetivo - ahora;
    const horas = Math.floor((diferencia / (1000 * 60 * 60)) % 24);
    const minutos = Math.floor((diferencia / 1000 / 60) % 60);
    const segundos = Math.floor((diferencia / 1000) % 60);

    const el = document.getElementById('timerBCV');
    if (el) {
      el.innerText = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
    }
  }
  actualizarTimer();
  setInterval(actualizarTimer, 1000);
}

// ======================== PWA INSTALACIÓN (ANDROID + iOS + IN-APP) ========================

function esAppInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function actualizarVisibilidadBotonInstalar() {
  const btn = document.getElementById('btnInstalarApp');
  if (!btn) return;
  if (esAppInstalada()) {
    btn.classList.add('hidden');
  } else {
    btn.classList.remove('hidden');
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  eventoInstalacionDirecta = e;
  const btn = document.getElementById('btnInstalarApp');
  if (btn) {
    btn.classList.remove('hidden');
    btn.classList.add('ring-2', 'ring-emerald-400/50');
  }
});

window.addEventListener('appinstalled', () => {
  eventoInstalacionDirecta = null;
  const btn = document.getElementById('btnInstalarApp');
  if (btn) btn.classList.add('hidden');
  toggleModalInstalar(false);
  mostrarToast("¡Maviko App instalada en tu pantalla de inicio!", "Instalación Completada", true);
});

async function accionInstalarApp() {
  vibrar();
  if (eventoInstalacionDirecta) {
    eventoInstalacionDirecta.prompt();
    const { outcome } = await eventoInstalacionDirecta.userChoice;
    if (outcome === 'accepted') {
      const icono = document.getElementById('iconoInstalarApp');
      const texto = document.getElementById('textoInstalarApp');
      if (icono && texto) {
        icono.className = "fa-solid fa-circle-notch fa-spin text-xs";
        texto.innerText = "Instalando...";
      }
    }
    eventoInstalacionDirecta = null;
    return;
  }

  // Respaldo inteligente para iPhone (Safari), Instagram/WhatsApp o navegadores sin prompt nativo
  mostrarGuiaInstalacion();
}

function mostrarGuiaInstalacion() {
  const ua = navigator.userAgent || '';
  const esIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esAndroid = /Android/i.test(ua);
  const esInApp = /Instagram|FBAN|FBAV|TikTok|WhatsApp|Line/i.test(ua);

  const box = document.getElementById('instruccionesInstalacion');
  const extra = document.getElementById('accionesInstalacionExtra');
  if (!box || !extra) return;

  if (esInApp) {
    box.innerHTML = `
      <p class="text-amber-300 font-bold flex items-center gap-1.5"><i class="fa-solid fa-triangle-exclamation"></i> Estás dentro de un navegador integrado</p>
      <p>Instagram/WhatsApp bloquean la instalación directa de apps. Para instalar <strong>Maviko</strong>:</p>
      <ol class="list-decimal list-inside space-y-1.5 text-zinc-200">
        <li>Toca los tres puntos <strong>(⋯ o ⋮)</strong> arriba a la derecha.</li>
        <li>Selecciona <strong>"Abrir en Chrome"</strong> o <strong>"Abrir en Safari"</strong>.</li>
        <li>Allí toca de nuevo <strong>Instalar App</strong>.</li>
      </ol>
    `;
    extra.innerHTML = `
      <button onclick="copiarEnlaceTienda()" class="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-2">
        <i class="fa-regular fa-copy"></i> Copiar enlace para abrir en Chrome / Safari
      </button>
    `;
  } else if (esIOS) {
    box.innerHTML = `
      <p class="font-bold text-white">Instalar en iPhone / iPad (Safari):</p>
      <ol class="list-decimal list-inside space-y-2 text-zinc-200">
        <li>Toca el botón <strong>Compartir</strong> <span class="inline-block bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700"><i class="fa-solid fa-arrow-up-from-bracket text-sky-400"></i></span> en la barra inferior de Safari.</li>
        <li>Desliza hacia abajo y elige <strong>"Agregar a inicio"</strong> <i class="fa-regular fa-square-plus text-emerald-400"></i>.</li>
        <li>Pulsa <strong>Agregar</strong> arriba a la derecha. ¡Listo!</li>
      </ol>
    `;
    extra.innerHTML = `
      <button onclick="toggleModalInstalar(false)" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">
        Entendido
      </button>
    `;
  } else if (esAndroid) {
    box.innerHTML = `
      <p class="font-bold text-white">Instalar en Android (Chrome):</p>
      <ol class="list-decimal list-inside space-y-2 text-zinc-200">
        <li>Toca el menú <strong>⋮</strong> en la esquina superior derecha de Chrome.</li>
        <li>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.</li>
        <li>Confirma tocando <strong>Instalar</strong>.</li>
      </ol>
    `;
    extra.innerHTML = `
      <button onclick="toggleModalInstalar(false)" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">
        Entendido
      </button>
    `;
  } else {
    box.innerHTML = `
      <p class="font-bold text-white">Instalar en tu PC (Chrome / Edge):</p>
      <ol class="list-decimal list-inside space-y-2 text-zinc-200">
        <li>Haz clic en el ícono de <strong>instalar</strong> <i class="fa-solid fa-desktop text-emerald-400"></i> en la parte derecha de la barra de direcciones.</li>
        <li>O abre el menú del navegador y elige <strong>"Instalar Maviko"</strong>.</li>
      </ol>
    `;
    extra.innerHTML = `
      <button onclick="toggleModalInstalar(false)" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">
        Entendido
      </button>
    `;
  }

  toggleModalInstalar(true);
}

function toggleModalInstalar(abrir) {
  document.getElementById('modalInstalarApp')?.classList.toggle('hidden', !abrir);
}

function copiarEnlaceTienda() {
  const url = window.location.origin + '/';
  navigator.clipboard?.writeText(url).then(() => {
    mostrarToast("Enlace copiado. Pégalo en Chrome o Safari para instalar la App.", "¡Enlace copiado!", true);
  });
}

// ======================== MODAL DETALLE, CARRUSEL, SWIPE Y COMPARTIR ========================

function iniciarPaseAutomatico() {
  pausarPaseAutomatico();
  if (fotosModalActuales.length <= 1) return;
  intervaloCarruselModal = setInterval(() => {
    const video = document.getElementById('videoPrincipalModal');
    if (video && !video.classList.contains('hidden')) return;
    indiceFotoModalActual = (indiceFotoModalActual + 1) % fotosModalActuales.length;
    seleccionarFotoModalPorIndice(indiceFotoModalActual);
  }, 3800);
}

function pausarPaseAutomatico() {
  if (intervaloCarruselModal) {
    clearInterval(intervaloCarruselModal);
    intervaloCarruselModal = null;
  }
}

function cambiarFotoRelativa(delta) {
  if (fotosModalActuales.length <= 1) return;
  vibrar();
  pausarPaseAutomatico();
  indiceFotoModalActual = (indiceFotoModalActual + delta + fotosModalActuales.length) % fotosModalActuales.length;
  seleccionarFotoModalPorIndice(indiceFotoModalActual);
  iniciarPaseAutomatico();
}

function seleccionarFotoModalPorIndice(idx) {
  const fotoPrincipal = document.getElementById('fotoPrincipalModal');
  const videoPrincipal = document.getElementById('videoPrincipalModal');
  const zoomHint = document.getElementById('zoomHint');
  const galeria = document.getElementById('galeriaMiniaturas');
  const contador = document.getElementById('contadorFotosModal');

  if (videoPrincipal) {
    videoPrincipal.pause();
    videoPrincipal.classList.add('hidden');
  }
  fotoPrincipal.classList.remove('hidden');
  zoomHint.classList.remove('hidden');
  fotoPrincipal.src = fotosModalActuales[idx] || IMAGEN_RESPALDO;
  indiceFotoModalActual = idx;
  resetearZoom();

  if (contador && fotosModalActuales.length > 1) {
    contador.textContent = `${idx + 1} / ${fotosModalActuales.length}`;
    contador.classList.remove('hidden');
  }

  Array.from(galeria.children).forEach((el, i) => {
    el.className = el.className.replace(/border-orange-500 ring-2 ring-orange-500\/20/g, 'border-zinc-800');
    if (i === idx) {
      el.className = el.className.replace('border-zinc-800', 'border-orange-500 ring-2 ring-orange-500/20');
    }
  });
}

function abrirDetalleProducto(id, pushHist = true) {
  const prod = productos.find(p => p.id === id);
  if (!prod) return;

  productoModalActual = prod;
  tallaSeleccionadaActual = "";
  fotosModalActuales = prod.galeriaFotos.length > 0 ? prod.galeriaFotos : [IMAGEN_RESPALDO];
  indiceFotoModalActual = 0;

  trackEvent('view_item', {
    currency: 'USD',
    value: prod.precioUSD,
    items: [{ item_id: prod.id, item_name: prod.nombre, item_category: prod.categoria, price: prod.precioUSD }]
  });

  document.getElementById('skuModal').innerText = `Ref: ${prod.id}`;
  document.getElementById('tituloModal').innerText = prod.nombre;
  document.getElementById('categoriaModal').innerText = prod.categoria;

  const estadoStock = document.getElementById('estadoStockModal');
  if (estadoStock) {
    if (prod.stockTotal <= 0) {
      estadoStock.className = "bg-amber-500/15 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-500/30";
      estadoStock.innerText = "Por Encargo";
    } else {
      estadoStock.className = "bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/20";
      estadoStock.innerText = `⚡ Entrega Inmediata (${prod.stockTotal})`;
    }
  }

  const precioAntEl = document.getElementById('precioAnteriorModal');
  if (prod.precioAnteriorUSD > 0) {
    precioAntEl.innerText = `$${prod.precioAnteriorUSD.toFixed(2)}`;
    precioAntEl.classList.remove('hidden');
  } else {
    precioAntEl.classList.add('hidden');
  }

  document.getElementById('precioModalUSD').innerText = `$${prod.precioUSD.toFixed(2)}`;
  document.getElementById('precioModalBS').innerText = `/ ${formatearBs(prod.precioUSD)}`;
  const footerUSD = document.getElementById('precioModalFooterUSD');
  const footerBS = document.getElementById('precioModalFooterBS');
  if (footerUSD) footerUSD.innerText = `$${prod.precioUSD.toFixed(2)}`;
  if (footerBS) footerBS.innerText = formatearBs(prod.precioUSD);
  document.getElementById('descModalText').innerText = prod.descripcion || 'Producto 100% original disponible en Maviko.';

  const msgConsulta = `¡Hola Maviko! Me interesa el producto *${prod.nombre}* (Ref: ${prod.id}) de $${prod.precioUSD.toFixed(2)}. ¿Tienen disponibilidad?`;
  document.getElementById('btnConsultaDirectaModal').href = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(msgConsulta)}`;

  const boxTallas = document.getElementById('boxTallasModal');
  const gridTallas = document.getElementById('gridTallasModal');
  const labelTalla = document.getElementById('labelTallaSeleccionada');
  gridTallas.innerHTML = '';
  labelTalla.innerText = '';

  if (prod.tieneTallas) {
    boxTallas.classList.remove('hidden');
    Object.entries(prod.mapaTallas).forEach(([talla, stockTalla]) => {
      const btnTalla = document.createElement('button');
      btnTalla.type = "button";
      btnTalla.className = "btn-talla bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3.5 py-1.5 rounded-xl text-xs border border-zinc-700 transition-all cursor-pointer";
      btnTalla.innerText = stockTalla > 0 ? `${talla} (${stockTalla})` : `${talla} (Encargo)`;
      btnTalla.onclick = () => {
        vibrar();
        document.querySelectorAll('.btn-talla').forEach(b => {
          b.classList.remove('bg-orange-600', 'text-white', 'border-orange-500');
          b.classList.add('bg-zinc-800', 'text-zinc-300', 'border-zinc-700');
        });
        btnTalla.classList.remove('bg-zinc-800', 'text-zinc-300', 'border-zinc-700');
        btnTalla.classList.add('bg-orange-600', 'text-white', 'border-orange-500');
        tallaSeleccionadaActual = talla;
        labelTalla.innerText = stockTalla > 0 ? `Opción: ${talla} (${stockTalla} disp.)` : `Opción: ${talla} (Por encargo)`;
      };
      gridTallas.appendChild(btnTalla);
    });
  } else {
    boxTallas.classList.add('hidden');
  }

  const fotoPrincipal = document.getElementById('fotoPrincipalModal');
  const videoPrincipal = document.getElementById('videoPrincipalModal');
  const zoomHint = document.getElementById('zoomHint');
  const btnPrev = document.getElementById('btnPrevFoto');
  const btnNext = document.getElementById('btnNextFoto');
  const contadorFotos = document.getElementById('contadorFotosModal');

  videoPrincipal.pause();
  videoPrincipal.classList.add('hidden');
  fotoPrincipal.classList.remove('hidden');
  zoomHint.classList.remove('hidden');
  fotoPrincipal.src = fotosModalActuales[0];
  fotoPrincipal.onerror = () => { fotoPrincipal.src = IMAGEN_RESPALDO; };
  resetearZoom();

  const tieneMultiples = fotosModalActuales.length > 1;
  btnPrev?.classList.toggle('hidden', !tieneMultiples);
  btnNext?.classList.toggle('hidden', !tieneMultiples);
  if (contadorFotos) {
    contadorFotos.classList.toggle('hidden', !tieneMultiples);
    contadorFotos.textContent = `1 / ${fotosModalActuales.length}`;
  }

  const galeria = document.getElementById('galeriaMiniaturas');
  galeria.innerHTML = '';

  fotosModalActuales.forEach((imgUrl, idx) => {
    const thumb = document.createElement('div');
    thumb.className = `w-14 h-14 rounded-xl border flex items-center justify-center p-1 bg-zinc-950 cursor-pointer transition-all shrink-0 ${idx === 0 ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-zinc-800 hover:border-zinc-600'}`;
    thumb.innerHTML = `<img src="${escapeHTML(imgUrl)}" loading="lazy" onerror="this.src='${IMAGEN_RESPALDO}'" class="max-w-full max-h-full object-contain pointer-events-none">`;
    thumb.onclick = () => seleccionarFotoModalPorIndice(idx);
    galeria.appendChild(thumb);
  });

  if (prod.videoURL) {
    const thumbVideo = document.createElement('div');
    thumbVideo.className = "w-14 h-14 rounded-xl border border-zinc-800 hover:border-zinc-600 flex flex-col items-center justify-center p-1 bg-zinc-950 text-orange-400 cursor-pointer transition-all shrink-0";
    thumbVideo.innerHTML = `<i class="fa-solid fa-play text-sm"></i><span class="text-[9px] font-bold mt-0.5 text-zinc-300">Video</span>`;
    thumbVideo.onclick = () => {
      pausarPaseAutomatico();
      fotoPrincipal.classList.add('hidden');
      zoomHint.classList.add('hidden');
      videoPrincipal.classList.remove('hidden');
      videoPrincipal.src = prod.videoURL;
      videoPrincipal.play().catch(() => {});
      Array.from(galeria.children).forEach(el => {
        el.className = el.className.replace(/border-orange-500 ring-2 ring-orange-500\/20/g, 'border-zinc-800');
      });
      thumbVideo.className = thumbVideo.className.replace('border-zinc-800', 'border-orange-500 ring-2 ring-orange-500/20');
    };
    galeria.appendChild(thumbVideo);
  }

  const fichaList = document.getElementById('fichaModalList');
  fichaList.innerHTML = '';
  if (prod.fichaTecnica && prod.fichaTecnica.length > 0) {
    prod.fichaTecnica.forEach(item => {
      const li = document.createElement('li');
      li.innerText = item;
      fichaList.appendChild(li);
    });
  } else {
    fichaList.innerHTML = `<li class="text-zinc-500">Sin especificaciones adicionales.</li>`;
  }

  const btnAgregar = document.getElementById('btnAgregarModal');
  btnAgregar.className = "flex-grow bg-orange-600 hover:bg-orange-500 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm";
  btnAgregar.innerHTML = prod.stockTotal <= 0
    ? `<i class="fa-solid fa-clock text-sm"></i> <span>Solicitar por Encargo</span>`
    : `<i class="fa-solid fa-cart-plus text-sm"></i> <span>Agregar al Carrito</span>`;

  btnAgregar.onclick = () => {
    if (prod.tieneTallas && !tallaSeleccionadaActual) {
      mostrarToast("Por favor selecciona una opción o talla antes de agregar.", "Selecciona tu talla", true);
      document.getElementById('boxTallasModal')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    vibrar();
    agregarAlCarrito(prod.id, tallaSeleccionadaActual);
    cerrarDetalle();
  };

  actualizarBotonFavoritoModal();
  renderProductosRelacionados(prod);
  cambiarTab('desc');
  const modalEl = document.getElementById('modalDetalle');
  modalEl.classList.remove('hidden');
  const modalBody = document.getElementById('modalDetalleBody');
  if (modalBody) modalBody.scrollTop = 0;
  document.body.classList.add('overflow-hidden');
  iniciarPaseAutomatico();

  // Actualizar URL con ?id=SKU y habilitar botón "Atrás" del móvil
  if (pushHist) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('id', prod.id);
      history.pushState({ modal: 'detalle', id: prod.id }, '', url.toString());
      historialModalActivo = true;
    } catch (e) {}
  }
}

function renderProductosRelacionados(prodActual) {
  const seccion = document.getElementById('seccionRelacionados');
  const grid = document.getElementById('gridRelacionados');
  if (!seccion || !grid) return;

  const candidatos = productos
    .filter(p => p.id !== prodActual.id)
    .map(p => {
      let score = 0;
      if (p.categoria === prodActual.categoria) score += 3;
      if (prodActual.marca && p.marca && p.marca.toLowerCase() === prodActual.marca.toLowerCase()) score += 4;
      if (p.stockTotal > 0) score += 1;
      return { p, score };
    })
    .filter(x => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(x => x.p);

  if (candidatos.length === 0) {
    seccion.classList.add('hidden');
    grid.innerHTML = '';
    return;
  }

  seccion.classList.remove('hidden');
  grid.innerHTML = candidatos.map(r => `
    <button type="button" data-action="detalle" data-id="${escapeHTML(r.id)}" class="bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-orange-500/50 rounded-xl p-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 group">
      <div class="h-20 rounded-lg bg-black/50 flex items-center justify-center p-1 overflow-hidden">
        <img src="${escapeHTML(r.imagen || IMAGEN_RESPALDO)}" alt="${escapeHTML(r.nombre)}" loading="lazy" onerror="this.src='${IMAGEN_RESPALDO}'" class="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200">
      </div>
      <div>
        <p class="text-[11px] font-bold text-zinc-200 line-clamp-1">${escapeHTML(r.nombre)}</p>
        <p class="text-xs font-extrabold text-orange-400">$${r.precioUSD.toFixed(2)}</p>
      </div>
    </button>
  `).join('');
}

const TABLAS_TALLAS = {
  caballero: [
    { eu: '39', us: '6.5', cm: '24.5 cm' },
    { eu: '40', us: '7', cm: '25.0 cm' },
    { eu: '41', us: '8', cm: '26.0 cm' },
    { eu: '42', us: '8.5', cm: '26.5 cm' },
    { eu: '43', us: '9.5', cm: '27.5 cm' },
    { eu: '44', us: '10', cm: '28.0 cm' },
    { eu: '45', us: '11', cm: '29.0 cm' },
    { eu: '46', us: '12', cm: '30.0 cm' }
  ],
  dama: [
    { eu: '35', us: '5', cm: '22.0 cm' },
    { eu: '36', us: '5.5', cm: '22.5 cm' },
    { eu: '37', us: '6.5', cm: '23.5 cm' },
    { eu: '38', us: '7', cm: '24.0 cm' },
    { eu: '39', us: '8', cm: '25.0 cm' },
    { eu: '40', us: '8.5', cm: '25.5 cm' },
    { eu: '41', us: '9.5', cm: '26.5 cm' }
  ]
};

function toggleGuiaTallas(abrir) {
  const modal = document.getElementById('modalGuiaTallas');
  if (!modal) return;
  modal.classList.toggle('hidden', !abrir);
  if (abrir) cambiarTabGuiaTallas('caballero');
}

function cambiarTabGuiaTallas(genero) {
  const btnCab = document.getElementById('tabGuiaCaballero');
  const btnDama = document.getElementById('tabGuiaDama');
  const tabla = document.getElementById('tablaGuiaTallas');
  if (!tabla) return;

  if (btnCab && btnDama) {
    if (genero === 'caballero') {
      btnCab.className = "bg-orange-600 text-white py-1.5 rounded-lg cursor-pointer transition-colors";
      btnDama.className = "text-zinc-400 hover:text-white py-1.5 rounded-lg cursor-pointer transition-colors";
    } else {
      btnDama.className = "bg-orange-600 text-white py-1.5 rounded-lg cursor-pointer transition-colors";
      btnCab.className = "text-zinc-400 hover:text-white py-1.5 rounded-lg cursor-pointer transition-colors";
    }
  }

  const filas = TABLAS_TALLAS[genero] || TABLAS_TALLAS.caballero;
  tabla.innerHTML = `
    <table class="w-full text-center border-collapse">
      <thead class="bg-zinc-900 text-zinc-400 text-[11px] uppercase">
        <tr>
          <th class="py-2 px-3 border-b border-zinc-800">Talla EU / VE</th>
          <th class="py-2 px-3 border-b border-zinc-800">Talla US</th>
          <th class="py-2 px-3 border-b border-zinc-800">Largo del pie</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-800/70 text-zinc-200">
        ${filas.map(f => `
          <tr class="hover:bg-zinc-900/60">
            <td class="py-2 px-3 font-bold text-orange-400">${f.eu}</td>
            <td class="py-2 px-3">${f.us}</td>
            <td class="py-2 px-3 font-mono text-zinc-300">${f.cm}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function compartirProductoActual() {
  if (!productoModalActual) return;
  vibrar();
  const url = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(productoModalActual.id)}`;
  const texto = `Mira *${productoModalActual.nombre}* en Maviko por $${productoModalActual.precioUSD.toFixed(2)} USD (${formatearBs(productoModalActual.precioUSD)})`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${productoModalActual.nombre} | Maviko`,
        text: texto,
        url
      });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    mostrarToast("Enlace del producto copiado. ¡Compártelo por WhatsApp o Instagram!", "Enlace copiado", true);
  } catch (e) {
    mostrarToast(url, "Copia este enlace", true);
  }
}

function aplicarZoom(e) {
  const container = e.currentTarget;
  const img = container.querySelector('#fotoPrincipalModal');
  if (!img || img.classList.contains('hidden')) return;

  const rect = container.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;

  img.style.transformOrigin = `${x}% ${y}%`;
  img.style.transform = "scale(2.1)";
}

function resetearZoom() {
  const img = document.querySelector('#fotoPrincipalModal');
  if (img) {
    img.style.transform = "scale(1)";
    img.style.transformOrigin = "center center";
  }
}

function cerrarDetallePorOverlay(e) {
  if (e.target.id === 'modalDetalle') cerrarDetalle();
}

function cerrarDetalle(desdePopState = false) {
  const modal = document.getElementById('modalDetalle');
  if (!modal || modal.classList.contains('hidden')) return;

  pausarPaseAutomatico();
  const video = document.getElementById('videoPrincipalModal');
  if (video) video.pause();
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  resetearZoom();
  productoModalActual = null;

  if (!desdePopState && historialModalActivo) {
    historialModalActivo = false;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      history.replaceState({}, '', url.toString());
    } catch (e) {}
  } else {
    historialModalActivo = false;
  }
}

function cambiarTab(tab) {
  const btnDesc = document.getElementById('tabDescBtn');
  const btnFicha = document.getElementById('tabFichaBtn');
  const boxDesc = document.getElementById('tabDescripcion');
  const boxFicha = document.getElementById('tabFicha');

  if (tab === 'desc') {
    boxDesc.classList.remove('hidden');
    boxFicha.classList.add('hidden');
    btnDesc.className = "tab-btn text-orange-400 border-b-2 border-orange-500 pb-2 cursor-pointer transition-colors";
    btnFicha.className = "tab-btn text-zinc-400 hover:text-zinc-200 pb-2 cursor-pointer transition-colors";
  } else {
    boxDesc.classList.add('hidden');
    boxFicha.classList.remove('hidden');
    btnFicha.className = "tab-btn text-orange-400 border-b-2 border-orange-500 pb-2 cursor-pointer transition-colors";
    btnDesc.className = "tab-btn text-zinc-400 hover:text-zinc-200 pb-2 cursor-pointer transition-colors";
  }
}

// ======================== CARRITO Y CHECKOUT ========================

function agregarAlCarritoAccionDirecta(id) {
  vibrar();
  const prod = productos.find(p => p.id === id);
  if (!prod) return;
  if (prod.tieneTallas) {
    abrirDetalleProducto(id);
  } else {
    agregarAlCarrito(id, "");
  }
}

function agregarAlCarrito(id, talla = "") {
  const prod = productos.find(p => p.id === id);
  if (!prod) return;
  const claveCarrito = `${id}-${talla}`;
  const existe = carrito.find(item => item.clave === claveCarrito);

  const limiteStock = prod.tieneTallas ? (prod.mapaTallas[talla] || 0) : prod.stockTotal;
  const modalidadInicial = limiteStock <= 0 ? 'Encargo' : 'Inmediata';

  if (existe) {
    if (existe.modalidad === 'Inmediata' && existe.cantidad + 1 > limiteStock) {
      alert(`Solo quedan ${limiteStock} unidades para entrega inmediata. Puedes cambiar su modalidad a "Por Encargo" dentro del carrito.`);
      return;
    }
    existe.cantidad++;
  } else {
    carrito.push({
      ...prod,
      clave: claveCarrito,
      tallaSeleccionada: talla,
      cantidad: 1,
      modalidad: modalidadInicial
    });
  }

  trackEvent('add_to_cart', {
    currency: 'USD',
    value: prod.precioUSD,
    items: [{ item_id: prod.id, item_name: prod.nombre, price: prod.precioUSD, quantity: 1 }]
  });

  guardarCarritoEnStorage();
  actualizarCarritoUI();

  const textoTalla = talla ? ` (${talla})` : '';
  mostrarToast(`${prod.nombre}${textoTalla}`);
}

function agregarEncargoExternoAlCarrito() {
  const nombre = document.getElementById('extNombreProd').value.trim();
  const detalle = document.getElementById('extTallaColor').value.trim();
  if (!nombre) {
    alert("Escribe el nombre o descripción del artículo que deseas encargar.");
    return;
  }
  const idExt = `EXT-${Date.now().toString().slice(-4)}`;
  carrito.push({
    id: idExt,
    clave: idExt,
    nombre: `${nombre} (Por cotizar)`,
    precioUSD: 0,
    imagen: IMAGEN_RESPALDO,
    tallaSeleccionada: detalle,
    cantidad: 1,
    modalidad: 'Encargo',
    esExterno: true
  });
  document.getElementById('extNombreProd').value = '';
  document.getElementById('extTallaColor').value = '';
  toggleEncargoExterno(false);
  guardarCarritoEnStorage();
  actualizarCarritoUI();
  mostrarToast("Artículo especial añadido a tu lista de encargo", "Encargo Agregado", true);
}

function cambiarModalidadItem(clave, nuevaModalidad) {
  const item = carrito.find(i => i.clave === clave);
  if (item) {
    item.modalidad = nuevaModalidad;
    guardarCarritoEnStorage();
    actualizarCarritoUI();
  }
}

function cambiarCantidad(clave, delta) {
  vibrar();
  const item = carrito.find(i => i.clave === clave);
  if (item) {
    const prod = productos.find(p => p.id === item.id);
    const limiteStock = prod ? (item.tallaSeleccionada ? (prod.mapaTallas[item.tallaSeleccionada] || 0) : prod.stockTotal) : 99;

    if (delta > 0 && item.modalidad === 'Inmediata' && item.cantidad + 1 > limiteStock) {
      alert(`Límite disponible en entrega inmediata: ${limiteStock} und.`);
      return;
    }

    item.cantidad += delta;
    if (item.cantidad <= 0) {
      carrito = carrito.filter(i => i.clave !== clave);
    }
  }
  guardarCarritoEnStorage();
  actualizarCarritoUI();
}

function eliminarItemCarrito(clave) {
  vibrar();
  carrito = carrito.filter(i => i.clave !== clave);
  guardarCarritoEnStorage();
  actualizarCarritoUI();
}

function vaciarCarrito() {
  if (carrito.length === 0) return;
  if (confirm("¿Estás seguro de que deseas vaciar tu carrito?")) {
    carrito = [];
    cuponAplicado = null;
    const msgCupon = document.getElementById('mensajeCuponEstado');
    if (msgCupon) msgCupon.classList.add('hidden');
    guardarCarritoEnStorage();
    actualizarCarritoUI();
  }
}

function actualizarCostoEnvio() {
  const select = document.getElementById('empresaEnvio');
  const selectedOption = select.options[select.selectedIndex];
  const costo = parseFloat(selectedOption.getAttribute('data-costo')) || 0;
  costoEnvioAdicional = costo;

  const textoCosto = document.getElementById('costoEnvioText');
  if (costo > 0) {
    textoCosto.innerText = `+$${costo.toFixed(2)}`;
  } else if (select.value === 'Retiro en Tienda') {
    textoCosto.innerText = "Gratis";
  } else {
    textoCosto.innerText = "Cobro en destino";
  }

  actualizarCarritoUI();
}

function actualizarCarritoUI() {
  const count = carrito.reduce((acc, i) => acc + i.cantidad, 0);
  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl) cartCountEl.innerText = count;

  const listContainer = document.getElementById('cartItemsList');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  if (carrito.length === 0) {
    listContainer.innerHTML = `
      <div class="text-center py-16 text-zinc-500 space-y-2">
        <i class="fa-solid fa-basket-shopping text-3xl mb-2 text-zinc-600"></i>
        <p class="text-sm font-medium">Tu carrito está vacío</p>
      </div>
    `;
  } else {
    carrito.forEach(i => {
      const safeClave = escapeHTML(i.clave);
      const safeNombre = escapeHTML(i.nombre);
      const safeImg = escapeHTML(i.imagen || IMAGEN_RESPALDO);
      const textoTalla = i.tallaSeleccionada
        ? `<span class="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-1.5 py-0.5 rounded ml-1">${escapeHTML(i.tallaSeleccionada)}</span>`
        : '';

      const itemEl = document.createElement('div');
      itemEl.className = "py-3 flex items-center justify-between gap-3";
      itemEl.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-16 h-16 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center p-1.5 shrink-0">
            <img src="${safeImg}" onerror="this.src='${IMAGEN_RESPALDO}'" class="max-w-full max-h-full object-contain">
          </div>
          <div class="space-y-1 min-w-0">
            <h4 class="font-bold text-xs text-white leading-snug">${safeNombre} ${textoTalla}</h4>
            <p class="text-xs text-orange-400 font-semibold">${i.esExterno ? 'Cotización WhatsApp' : '$' + (i.precioUSD * i.cantidad).toFixed(2)}</p>
            <select data-action="modalidad" data-clave="${safeClave}" class="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-0.5 text-[10px] font-bold ${i.modalidad === 'Encargo' ? 'text-amber-400' : 'text-emerald-400'}">
              <option value="Inmediata" ${i.modalidad === 'Inmediata' ? 'selected' : ''}>⚡ Compra Inmediata</option>
              <option value="Encargo" ${i.modalidad === 'Encargo' ? 'selected' : ''}>📦 Por Encargo</option>
            </select>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" data-action="menos" data-clave="${safeClave}" class="w-6 h-6 bg-zinc-800 rounded text-zinc-300 font-bold text-xs cursor-pointer hover:bg-zinc-700 flex items-center justify-center">-</button>
          <span class="text-xs font-bold w-4 text-center text-white">${i.cantidad}</span>
          <button type="button" data-action="mas" data-clave="${safeClave}" class="w-6 h-6 bg-zinc-800 rounded text-zinc-300 font-bold text-xs cursor-pointer hover:bg-zinc-700 flex items-center justify-center">+</button>
          <button type="button" data-action="eliminar" data-clave="${safeClave}" class="w-6 h-6 text-zinc-500 hover:text-rose-400 text-xs cursor-pointer flex items-center justify-center ml-1" title="Eliminar">
            <i class="fa-solid fa-trash-can pointer-events-none"></i>
          </button>
        </div>
      `;
      listContainer.appendChild(itemEl);
    });
  }

  const subtotalUSD = carrito.reduce((acc, i) => acc + (i.precioUSD * i.cantidad), 0);

  let descuentoUSD = 0;
  const filaCupon = document.getElementById('filaDescuentoCupon');
  const msgCupon = document.getElementById('mensajeCuponEstado');
  if (cuponAplicado && subtotalUSD > 0) {
    if (subtotalUSD >= cuponAplicado.minCompraUSD) {
      descuentoUSD = cuponAplicado.descuentoUSD;
      filaCupon.classList.remove('hidden');
      document.getElementById('montoDescuentoCupon').innerText = descuentoUSD.toFixed(2);
      msgCupon.className = "text-[11px] font-semibold text-emerald-400";
      msgCupon.innerText = `✓ Cupón ${cuponAplicado.codigo} aplicado (-$${descuentoUSD} USD).`;
      msgCupon.classList.remove('hidden');
    } else {
      filaCupon.classList.add('hidden');
      msgCupon.className = "text-[11px] font-semibold text-amber-400";
      msgCupon.innerText = `El cupón ${cuponAplicado.codigo} requiere una compra mínima de $${cuponAplicado.minCompraUSD} USD.`;
      msgCupon.classList.remove('hidden');
    }
  } else {
    filaCupon.classList.add('hidden');
  }

  const totalUSD = Math.max(0, subtotalUSD - descuentoUSD) + (subtotalUSD > 0 ? costoEnvioAdicional : 0);
  const totalBS = tasaBCV > 0
    ? (totalUSD * tasaBCV).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';

  const itemsEncargo = carrito.filter(i => i.modalidad === 'Encargo');
  const boxEncargo = document.getElementById('boxOpcionesEncargo');
  if (itemsEncargo.length > 0) {
    boxEncargo.classList.remove('hidden');
    const totalEncargoUSD = itemsEncargo.reduce((acc, i) => acc + (i.precioUSD * i.cantidad), 0);
    const plan = document.getElementById('planPagoEncargo').value;
    const resumenEl = document.getElementById('resumenCuotasEncargo');
    if (plan.includes('2 Partes')) {
      const abono = (totalEncargoUSD * 0.5).toFixed(2);
      resumenEl.innerText = `Abono Inicial (50%): $${abono} USD | Saldo al llegar (50%): $${abono} USD`;
    } else {
      resumenEl.innerText = `Pago Único Total Encargo: $${totalEncargoUSD.toFixed(2)} USD`;
    }
  } else {
    boxEncargo.classList.add('hidden');
  }

  const barraMeta = document.getElementById('barraMetaEnvio');
  const textoMeta = document.getElementById('textoMetaEnvio');
  if (barraMeta && textoMeta) {
    const porcentaje = Math.min(100, (subtotalUSD / META_ENVIO_USD) * 100);
    barraMeta.style.width = `${porcentaje}%`;
    if (subtotalUSD >= META_ENVIO_USD) {
      barraMeta.classList.replace('bg-orange-500', 'bg-emerald-500');
      textoMeta.innerHTML = `🎉 <strong class="text-emerald-400">¡Despacho prioritario y embalaje blindado desbloqueado!</strong>`;
    } else {
      barraMeta.classList.replace('bg-emerald-500', 'bg-orange-500');
      const faltante = (META_ENVIO_USD - subtotalUSD).toFixed(2);
      textoMeta.innerHTML = `Te faltan <strong class="text-orange-400">$${faltante}</strong> para despacho prioritario sin costo de embalaje`;
    }
  }

  document.getElementById('subtotalUSD').innerText = subtotalUSD.toFixed(2);
  document.getElementById('totalUSD').innerText = totalUSD.toFixed(2);
  document.getElementById('totalBS').innerText = totalBS;

  // Actualizar barra inferior flotante del carrito en móvil y posición del botón WhatsApp
  const barraMovil = document.getElementById('barraCarritoMovil');
  const movilCount = document.getElementById('movilCartCount');
  const movilSub = document.getElementById('movilCartSub');
  const btnWa = document.getElementById('floatingWhatsApp');

  if (barraMovil) {
    if (count > 0) {
      barraMovil.classList.remove('hidden');
      if (movilCount) movilCount.innerText = count;
      if (movilSub) movilSub.innerText = `$${totalUSD.toFixed(2)} USD${tasaBCV > 0 ? ' · ' + totalBS + ' Bs.' : ''}`;
      if (btnWa) {
        btnWa.classList.remove('bottom-6');
        btnWa.classList.add('bottom-20', 'sm:bottom-6');
      }
    } else {
      barraMovil.classList.add('hidden');
      if (btnWa) {
        btnWa.classList.remove('bottom-20', 'sm:bottom-6');
        btnWa.classList.add('bottom-6');
      }
    }
  }
}

function mostrarDatosPago() {
  const metodo = document.getElementById('metodoPago').value;
  const box = document.getElementById('infoPagoBox');
  const campoRef = document.getElementById('campoReferencia');

  if (metodo === 'Pago Móvil') {
    campoRef.classList.remove('hidden');
    box.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <p class="font-bold text-orange-400">Datos para Pago Móvil:</p>
        <div class="flex gap-1">
          <button type="button" onclick="toggleQRModal(true)" class="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-zinc-700 cursor-pointer">QR</button>
          <button type="button" onclick="copiarDatosPagoMovil(this)" class="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-semibold border border-zinc-700 transition-all flex items-center gap-1 cursor-pointer">
            <i class="fa-regular fa-copy text-orange-400"></i> <span>Copiar</span>
          </button>
        </div>
      </div>
      <p class="text-zinc-300"><strong>Banco:</strong> ${DATOS_PAGO_MOVIL.banco} | <strong>CI:</strong> ${DATOS_PAGO_MOVIL.cedula} | <strong>Tel:</strong> ${DATOS_PAGO_MOVIL.telefono}</p>
    `;
  } else if (metodo === 'Zelle') {
    campoRef.classList.remove('hidden');
    box.innerHTML = `
      <p class="font-bold text-orange-400 mb-0.5">Datos para Zelle:</p>
      <p class="text-zinc-300"><strong>Correo:</strong> pagos@maviko.com | <strong>Titular:</strong> Maviko C.A.</p>
    `;
  } else {
    campoRef.classList.add('hidden');
    box.innerHTML = `
      <p class="font-bold text-orange-400 mb-0.5">Efectivo contra entrega:</p>
      <p class="text-zinc-300">Pagas en divisas/efectivo al momento de la entrega acordada.</p>
    `;
  }
}

function toggleCarrito(forceOpen = false, desdePopState = false) {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (!drawer || !overlay) return;

  const estaCerrado = drawer.classList.contains('translate-x-full');
  const abrir = forceOpen ? true : estaCerrado;

  if (abrir) {
    drawer.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => overlay.classList.remove('opacity-0'), 10);
    if (!historialCarritoActivo) {
      try {
        history.pushState({ modal: 'carrito' }, '');
        historialCarritoActivo = true;
      } catch (e) {}
    }
  } else {
    drawer.classList.add('translate-x-full');
    overlay.classList.add('opacity-0');
    document.body.classList.remove('overflow-hidden');
    setTimeout(() => overlay.classList.add('hidden'), 300);
    if (desdePopState) historialCarritoActivo = false;
  }
}

function enviarFormularioSheets(formData) {
  const uniqueName = `hidden_iframe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const iframe = document.createElement('iframe');
  iframe.name = uniqueName;
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = WEBHOOK_APPSCRIPT_URL;
  form.target = uniqueName;

  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'data';
  input.value = JSON.stringify(formData);
  form.appendChild(input);

  document.body.appendChild(form);
  form.submit();
  setTimeout(() => {
    form.remove();
    iframe.remove();
  }, 5000);
}

function enviarPedidoWhatsApp() {
  if (!carrito.length) {
    alert("Tu carrito está vacío.");
    return;
  }
  const cliente = document.getElementById('nombreCliente').value.trim();
  const telefono = document.getElementById('telefonoCliente').value.trim();
  const metodo = document.getElementById('metodoPago').value;
  const ref = document.getElementById('referenciaPago')?.value.trim() || "";
  const agencia = document.getElementById('empresaEnvio').value;
  const direccion = document.getElementById('direccionEnvio').value.trim();
  const fechaEncargo = document.getElementById('fechaEncargo')?.value || '';
  const planEncargo = document.getElementById('planPagoEncargo')?.value || '2 Partes (50% Abono / 50% Entrega)';

  if (!cliente || !telefono) {
    alert("Por favor completa tu Nombre y WhatsApp.");
    return;
  }

  guardarDatosCliente();

  const subtotalUSD = carrito.reduce((acc, i) => acc + (i.precioUSD * i.cantidad), 0);
  const descuentoUSD = (cuponAplicado && subtotalUSD >= cuponAplicado.minCompraUSD) ? cuponAplicado.descuentoUSD : 0;
  const totalUSD = Math.max(0, subtotalUSD - descuentoUSD) + (subtotalUSD > 0 ? costoEnvioAdicional : 0);
  const tasaSegura = tasaBCV > 0 ? tasaBCV : 0;
  const totalBS = tasaSegura > 0
    ? (totalUSD * tasaSegura).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : 'Consultar';

  const itemsInmediatos = carrito.filter(i => i.modalidad !== 'Encargo');
  const itemsEncargo = carrito.filter(i => i.modalidad === 'Encargo');

  trackEvent('begin_checkout', { currency: 'USD', value: totalUSD });

  // 1. REGISTRO AUTOMÁTICO EN HOJA "Registro_Ventas" (artículos de compra inmediata)
  if (itemsInmediatos.length > 0) {
    const subInm = itemsInmediatos.reduce((acc, i) => acc + (i.precioUSD * i.cantidad), 0);
    const totInm = Math.max(0, subInm - descuentoUSD) + (subInm > 0 ? costoEnvioAdicional : 0);
    const prodsInm = itemsInmediatos
      .map(i => `${i.nombre}${i.tallaSeleccionada ? ' (' + i.tallaSeleccionada + ')' : ''} [x${i.cantidad}]`)
      .join(' | ');

    enviarFormularioSheets({
      tipo: "venta_confirmada",
      cliente,
      telefono,
      metodo_pago: metodo,
      referencia: ref,
      agencia_envio: agencia,
      direccion: direccion || "No especificada",
      cupon: descuentoUSD > 0 ? cuponAplicado.codigo : "",
      descuento_usd: descuentoUSD.toFixed(2),
      total_usd: totInm.toFixed(2),
      total_bs: (totInm * tasaSegura).toFixed(2),
      tasa_bcv: tasaSegura.toFixed(2),
      productos: prodsInm,
      vendedor: "WEB_DIRECTA"
    });
  }

  // 2. REGISTRO AUTOMÁTICO EN HOJA "Encargos_Web" (artículos por encargo / encargos especiales)
  if (itemsEncargo.length > 0) {
    const totEnc = itemsEncargo.reduce((acc, i) => acc + (i.precioUSD * i.cantidad), 0);
    const abono = planEncargo.includes('2 Partes') ? (totEnc * 0.5).toFixed(2) : totEnc.toFixed(2);
    const saldo = planEncargo.includes('2 Partes') ? (totEnc * 0.5).toFixed(2) : '0.00';
    const prodsEnc = itemsEncargo
      .map(i => `${i.nombre}${i.tallaSeleccionada ? ' (' + i.tallaSeleccionada + ')' : ''} [x${i.cantidad}]`)
      .join(' | ');

    enviarFormularioSheets({
      tipo: "encargo_pedido",
      cliente,
      telefono,
      producto: prodsEnc,
      fechaTentativa: fechaEncargo || 'Sin fecha definida',
      planPago: planEncargo,
      totalEncargoUSD: totEnc > 0 ? totEnc.toFixed(2) : 'Por cotizar',
      abonoInicialUSD: abono,
      saldoPendiente: saldo,
      metodo_pago: metodo,
      referencia: ref,
      agencia_envio: agencia,
      direccion: direccion || "No especificada"
    });
  }

  let mensaje = `*¡Hola Maviko! Quiero confirmar este pedido:*\n\n`;
  mensaje += `👤 *Cliente:* ${cliente}\n`;
  mensaje += `📱 *Teléfono:* ${telefono}\n`;
  mensaje += `🚚 *Entrega:* ${agencia}\n`;
  if (direccion) mensaje += `📍 *Destino:* ${direccion}\n`;
  mensaje += `💳 *Pago:* ${metodo}\n`;
  if (ref) mensaje += `🔢 *Referencia:* ${ref}\n`;

  if (itemsEncargo.length > 0) {
    mensaje += `📦 *Plan Encargo:* ${planEncargo}${fechaEncargo ? ' · Fecha: ' + fechaEncargo : ''}\n`;
  }

  mensaje += `\n📦 *Artículos:*\n`;
  carrito.forEach(i => {
    const etiquetaMod = i.modalidad === 'Encargo' ? ' (Encargo)' : '';
    const precioTxt = i.esExterno ? 'Por cotizar' : `$${(i.precioUSD * i.cantidad).toFixed(2)}`;
    mensaje += `• ${i.nombre}${i.tallaSeleccionada ? ' (' + i.tallaSeleccionada + ')' : ''}${etiquetaMod} [x${i.cantidad}] - ${precioTxt}\n`;
  });

  if (descuentoUSD > 0) mensaje += `\n🎟️ *Cupón (${cuponAplicado.codigo}):* -$${descuentoUSD.toFixed(2)}`;
  if (costoEnvioAdicional > 0) mensaje += `\n🚚 *Envío:* +$${costoEnvioAdicional.toFixed(2)}`;
  mensaje += `\n💵 *Total USD:* $${totalUSD.toFixed(2)}`;
  if (tasaSegura > 0) {
    mensaje += `\n🇻🇪 *Total Bs. (Tasa BCV ${tasaSegura.toFixed(2)}):* ${totalBS} Bs.\n\n`;
  } else {
    mensaje += `\n\n`;
  }
  mensaje += `⚠️ *Confirmo disponibilidad y tiempo de entrega antes de transferir.*`;

  vibrar();
  carrito = [];
  cuponAplicado = null;
  document.getElementById('mensajeCuponEstado')?.classList.add('hidden');
  guardarCarritoEnStorage();
  actualizarCarritoUI();
  toggleCarrito(false);

  window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// ======================== PUNTOS, CUPONES VERIFICADOS Y CLUB VIP ========================

function normalizarTelefonoConsulta(tel) {
  const soloDigitos = String(tel || '').replace(/\D/g, '');
  const sinPais = soloDigitos.length > 10 && soloDigitos.startsWith('58') ? soloDigitos.slice(2) : soloDigitos;
  return sinPais.replace(/^0+/, '') || soloDigitos;
}

async function consultarPedidosCliente() {
  const tel = document.getElementById('inputTelefonoConsulta').value.trim();
  const resBox = document.getElementById('resultadoPedidosCliente');
  if (!tel) {
    resBox.innerHTML = `<p class="text-amber-400">Por favor ingresa tu número de WhatsApp.</p>`;
    return;
  }

  const telConsulta = normalizarTelefonoConsulta(tel);
  resBox.innerHTML = `<p class="text-zinc-400"><i class="fa-solid fa-spinner fa-spin"></i> Consultando puntos y premios...</p>`;
  try {
    const resp = await fetch(`${WEBHOOK_APPSCRIPT_URL}?telefono=${encodeURIComponent(telConsulta)}`);
    const data = await resp.json();
    const puntos = parseInt(data.puntosTotales || 0, 10);

    let meta = 50;
    let premioTexto = "Cupón de $3 USD (compra mín. $25)";
    if (puntos >= 50 && puntos < 100) {
      meta = 100;
      premioTexto = "Cupón de $8 USD (compra mín. $50)";
    } else if (puntos >= 100) {
      meta = 200;
      premioTexto = "Cupón de $20 USD (compra mín. $80)";
    }

    const pct = Math.min(100, Math.round((puntos / meta) * 100));
    const faltan = Math.max(0, meta - puntos);

    let html = `
      <div class="bg-zinc-950 p-3.5 rounded-xl border border-amber-500/30 space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-zinc-400 font-semibold">Saldo Maviko Club:</span>
          <span class="text-lg font-black text-amber-400">${puntos} Puntos</span>
        </div>
        <div class="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
          <div class="bg-gradient-to-r from-orange-500 to-amber-400 h-full" style="width: ${pct}%"></div>
        </div>
        <p class="text-[11px] text-zinc-300">
          ${faltan > 0 ? `Te faltan <strong>${faltan} pts</strong> para desbloquear: <span class="text-amber-400">${premioTexto}</span>` : `🎉 ¡Ya desbloqueaste el nivel máximo!`}
        </p>
      </div>
    `;

    const verificados = [];
    const cupones = Array.isArray(data.cupones) ? data.cupones : [];
    if (cupones.length > 0) {
      html += `<div class="space-y-1.5"><p class="font-bold text-emerald-400">🎁 Tus Cupones de Regalo Activos:</p>`;
      cupones.forEach(c => {
        const codigo = String(c.codigo || '').trim().toUpperCase();
        const desc = parseFloat(c.descuentoUSD || 0);
        const min = parseFloat(c.minCompraUSD || 0);
        verificados.push({ codigo, descuentoUSD: desc, minCompraUSD: min });
        html += `
          <div class="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl flex justify-between items-center">
            <div>
              <p class="font-mono font-bold text-white text-xs">${escapeHTML(codigo)}</p>
              <p class="text-[10px] text-emerald-300">Descuento: $${desc} USD (Mín. $${min})</p>
            </div>
            <button onclick="aplicarCuponDesdeModal('${escapeHTML(codigo)}', ${desc}, ${min})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer">
              Usar en Carrito
            </button>
          </div>
        `;
      });
      html += `</div>`;
    } else if (puntos >= 50) {
      const descElegible = puntos >= 200 ? 20 : (puntos >= 100 ? 8 : 3);
      const minElegible = puntos >= 200 ? 80 : (puntos >= 100 ? 50 : 25);
      const telDigitos = tel.replace(/\D/g, '');
      const codAuto = `MAVIKO${descElegible}-${telDigitos.slice(-4)}`;
      verificados.push({ codigo: codAuto, descuentoUSD: descElegible, minCompraUSD: minElegible });
      html += `
        <div class="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl flex justify-between items-center">
          <div>
            <p class="font-mono font-bold text-white text-xs">${escapeHTML(codAuto)}</p>
            <p class="text-[10px] text-emerald-300">Premio desbloqueado: -$${descElegible} USD (Mín. $${minElegible})</p>
          </div>
          <button onclick="aplicarCuponDesdeModal('${escapeHTML(codAuto)}', ${descElegible}, ${minElegible})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer">
            Usar Ahora
          </button>
        </div>
      `;
    }

    if (verificados.length > 0) {
      guardarCuponesVerificados(verificados);
    }

    if (data.pedidos && data.pedidos.length > 0) {
      html += `<p class="font-bold text-white pt-1">Historial de Pedidos:</p>`;
      html += data.pedidos.map(p => `
        <div class="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
          <div class="flex justify-between font-bold text-white">
            <span>${escapeHTML(p.fecha)}</span>
            <span class="text-amber-400">+${escapeHTML(p.puntos || 0)} pts</span>
          </div>
          <p class="text-zinc-400">${escapeHTML(p.productos)}</p>
          <div class="flex justify-between text-[11px] pt-1">
            <span class="text-zinc-300">Estado: <strong>${escapeHTML(p.estado)}</strong></span>
            <span class="text-emerald-400 font-semibold">Guía: ${escapeHTML(p.guia || 'Pendiente')}</span>
          </div>
        </div>
      `).join('');
    } else {
      html += `<p class="text-zinc-500 text-[11px]">Aún no hay compras registradas con este número. ¡Suscríbete al Club VIP para ganar 10 puntos hoy!</p>`;
    }

    resBox.innerHTML = html;
  } catch (e) {
    resBox.innerHTML = `<p class="text-rose-400">Error al consultar el historial. Intenta nuevamente.</p>`;
  }
}

function aplicarCuponDesdeModal(codigo, descuentoUSD, minCompraUSD) {
  cuponAplicado = {
    codigo: String(codigo).toUpperCase(),
    descuentoUSD: parseFloat(descuentoUSD),
    minCompraUSD: parseFloat(minCompraUSD)
  };
  document.getElementById('inputCodigoCupon').value = cuponAplicado.codigo;
  toggleModalPedidos(false);
  toggleCarrito(true);
  actualizarCarritoUI();
  mostrarToast(`Cupón ${cuponAplicado.codigo} (-$${descuentoUSD} USD) listo para aplicar`, "¡Cupón Activado!", true);
}

async function validarYAplicarCupon() {
  const code = document.getElementById('inputCodigoCupon').value.trim().toUpperCase();
  const msgEl = document.getElementById('mensajeCuponEstado');
  const btn = document.getElementById('btnAplicarCupon');
  if (!code) return;

  // 1. Verificar si ya fue confirmado desde "Mis Puntos y Cupones" en esta sesión
  const verificados = leerCuponesVerificados();
  const encontradoLocal = verificados.find(c => c.codigo === code);
  if (encontradoLocal) {
    cuponAplicado = encontradoLocal;
    msgEl.className = "text-[11px] font-semibold text-emerald-400";
    msgEl.innerText = `✓ Cupón ${code} verificado (-$${encontradoLocal.descuentoUSD} USD en compras desde $${encontradoLocal.minCompraUSD}).`;
    msgEl.classList.remove('hidden');
    actualizarCarritoUI();
    return;
  }

  // 2. Validar contra el saldo real del cliente en Apps Script usando su WhatsApp
  const tel = (document.getElementById('telefonoCliente')?.value || document.getElementById('inputTelefonoConsulta')?.value || '').trim();
  if (!tel) {
    cuponAplicado = null;
    msgEl.className = "text-[11px] font-semibold text-amber-400";
    msgEl.innerText = "Ingresa primero tu número de WhatsApp arriba (o consulta en 'Mis Puntos') para validar tu cupón.";
    msgEl.classList.remove('hidden');
    actualizarCarritoUI();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = "...";
  }
  msgEl.className = "text-[11px] font-semibold text-zinc-400";
  msgEl.innerText = "Verificando cupón con Maviko Club...";
  msgEl.classList.remove('hidden');

  try {
    const telConsulta = normalizarTelefonoConsulta(tel);
    const resp = await fetch(`${WEBHOOK_APPSCRIPT_URL}?telefono=${encodeURIComponent(telConsulta)}`);
    const data = await resp.json();
    const puntos = parseInt(data.puntosTotales || 0, 10);
    const cuponesServidor = Array.isArray(data.cupones) ? data.cupones : [];

    // Buscar coincidencia exacta en cupones del servidor
    const matchServidor = cuponesServidor.find(c => String(c.codigo || '').trim().toUpperCase() === code);
    if (matchServidor) {
      cuponAplicado = {
        codigo: code,
        descuentoUSD: parseFloat(matchServidor.descuentoUSD),
        minCompraUSD: parseFloat(matchServidor.minCompraUSD)
      };
      guardarCuponesVerificados([...verificados, cuponAplicado]);
      actualizarCarritoUI();
      return;
    }

    // Verificar cupón automático basado en puntos reales y últimos 4 dígitos del teléfono
    const match = code.match(/^MAVIKO(3|8|20)-([0-9]{4})$/);
    const telDigitos = tel.replace(/\D/g, '');
    if (match && telDigitos.endsWith(match[2])) {
      const desc = parseInt(match[1], 10);
      const ptsRequeridos = desc === 20 ? 200 : (desc === 8 ? 100 : 50);
      const min = desc === 20 ? 80 : (desc === 8 ? 50 : 25);
      if (puntos >= ptsRequeridos) {
        cuponAplicado = { codigo: code, descuentoUSD: desc, minCompraUSD: min };
        guardarCuponesVerificados([...verificados, cuponAplicado]);
        actualizarCarritoUI();
        return;
      }
    }

    cuponAplicado = null;
    msgEl.className = "text-[11px] font-semibold text-rose-400";
    msgEl.innerText = "Cupón inválido o no disponible para este número. Revisa tus premios en 'Mis Puntos y Cupones'.";
    actualizarCarritoUI();
  } catch (e) {
    cuponAplicado = null;
    msgEl.className = "text-[11px] font-semibold text-rose-400";
    msgEl.innerText = "No se pudo verificar el cupón en este momento. Intenta de nuevo.";
    actualizarCarritoUI();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Aplicar";
    }
  }
}

async function registrarSuscriptorVIP() {
  const nombre = document.getElementById('vipNombre').value.trim();
  const telefono = document.getElementById('vipTelefono').value.trim();
  const interes = document.getElementById('vipInteres').value;

  if (!nombre || !telefono) {
    alert("Completa tu nombre y número de WhatsApp.");
    return;
  }

  trackEvent('sign_up', { method: 'Club VIP' });

  fetch(WEBHOOK_APPSCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    keepalive: true,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: JSON.stringify({ tipo: 'suscripcion_vip', nombre, telefono, interes })
  }).catch(() => {});

  toggleClubVIP(false);
  mostrarToast("¡Sumaste +10 Puntos de bienvenida en Maviko Club!", "¡Bienvenido al Club VIP!", true);
}

function programarCapturaAbandono() {
  clearTimeout(timerAbandonoLead);
  timerAbandonoLead = setTimeout(() => {
    const tel = document.getElementById('telefonoCliente').value.trim();
    const nombre = document.getElementById('nombreCliente').value.trim();
    if (tel.length >= 10 && carrito.length > 0) {
      const subtotalUSD = carrito.reduce((acc, i) => acc + (i.precioUSD * i.cantidad), 0);
      const totalBS = (subtotalUSD * (tasaBCV || 0)).toFixed(2);
      const prods = carrito.map(i => `${i.nombre} x${i.cantidad}`).join(', ');
      fetch(WEBHOOK_APPSCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: JSON.stringify({
          tipo: 'lead_abandonado',
          nombre: nombre || 'Cliente Web',
          telefono: tel,
          totalUSD: subtotalUSD.toFixed(2),
          totalBS,
          productos: prods
        })
      }).catch(() => {});
    }
  }, 6000);
}

// ======================== TOAST, MODALES Y PORTAPAPELES ========================

function copiarDatosPagoMovil(btn) {
  vibrar();
  const texto = `Banco: ${DATOS_PAGO_MOVIL.banco}\nCédula: ${DATOS_PAGO_MOVIL.cedula}\nTeléfono: ${DATOS_PAGO_MOVIL.telefono}`;
  navigator.clipboard?.writeText(texto).then(() => {
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i> <span class="text-emerald-400">¡Copiado!</span>`;
    mostrarToast("Datos de Pago Móvil copiados al portapapeles", "¡Copiado con éxito!", true);
    setTimeout(() => { btn.innerHTML = textoOriginal; }, 2200);
  });
}

function toggleQRModal(abrir) {
  document.getElementById('modalQR')?.classList.toggle('hidden', !abrir);
}

function toggleModalPedidos(abrir) {
  document.getElementById('modalPedidos')?.classList.toggle('hidden', !abrir);
}

function toggleClubVIP(abrir) {
  document.getElementById('modalClubVIP')?.classList.toggle('hidden', !abrir);
}

function toggleEncargoExterno(abrir) {
  document.getElementById('modalEncargoExterno')?.classList.toggle('hidden', !abrir);
}

function toggleEmpresaInfo() {
  document.getElementById('seccionEmpresa')?.classList.toggle('hidden');
}

function descartarAvisoCarrito() {
  document.getElementById('bannerCarritoPendiente')?.classList.add('hidden');
  sessionStorage.setItem('maviko_banner_descartado', '1');
}

function mostrarToast(mensaje, titulo = "¡Producto agregado!", ocultarBoton = false) {
  const toast = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMessage');
  const toastTitle = document.getElementById('toastTitle');
  const toastBtn = document.getElementById('toastBtnAccion');
  const toastIcon = document.getElementById('toastIcon');
  if (!toast) return;

  toastTitle.innerText = titulo;
  toastMsg.innerText = mensaje;

  if (ocultarBoton) {
    toastIcon.innerHTML = `<i class="fa-solid fa-bell text-base text-emerald-400"></i>`;
    toastIcon.className = "w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0";
    toastBtn.classList.add('hidden');
  } else {
    toastIcon.innerHTML = `<i class="fa-solid fa-check text-lg"></i>`;
    toastIcon.className = "w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0";
    toastBtn.classList.remove('hidden');
  }

  toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
    toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
  }, 3200);
}

// ======================== SERVICE WORKER E INICIALIZACIÓN ========================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW:', err));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarVisibilidadBotonInstalar();
  actualizarContadorFavoritos();
  mostrarDatosPago();
  cargarDatosClienteGuardados();
  actualizarCarritoUI();
  iniciarContadorBCV();

  // Recordar datos del cliente automáticamente al editar
  ['nombreCliente', 'telefonoCliente', 'direccionEnvio'].forEach(id => {
    document.getElementById(id)?.addEventListener('blur', guardarDatosCliente);
  });
  ['empresaEnvio', 'metodoPago'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', guardarDatosCliente);
  });

  // Botón Volver Arriba
  window.addEventListener('scroll', () => {
    const btn = document.getElementById('btnVolverArriba');
    if (btn) btn.classList.toggle('hidden', window.scrollY < 450);
  }, { passive: true });

  // Aplicar accesos directos desde URL (?filtro=ofertas | ?filtro=inmediata)
  const params = new URLSearchParams(window.location.search);
  const filtroUrl = params.get('filtro');
  if (filtroUrl === 'ofertas') {
    const sel = document.getElementById('ordenSelect');
    if (sel) sel.value = 'ofertas';
  } else if (filtroUrl === 'inmediata') {
    toggleSoloInmediata();
  }

  // Cargar catálogo instantáneamente desde caché y actualizar desde Google Sheets en segundo plano
  cargarCatalogoDesdeCache();
  obtenerTasaBCV();
  cargarCatalogoDesdeHoja();

  // Delegación de eventos en categorías (menú desplegable)
  document.getElementById('contenedorFiltros')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    filtrarCategoria(btn.dataset.cat);
  });

  // Delegación de eventos en marcas (panel flotante y cinta rápida)
  const manejarClickMarca = (e) => {
    const btn = e.target.closest('button[data-marca]');
    if (!btn) return;
    filtrarMarca(btn.dataset.marca);
  };
  document.getElementById('contenedorMarcasPanel')?.addEventListener('click', manejarClickMarca);
  document.getElementById('barraMarcas')?.addEventListener('click', manejarClickMarca);

  // Delegación de eventos en tallas (menú desplegable)
  document.getElementById('contenedorTallasPanel')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-talla]');
    if (!btn) return;
    filtrarTalla(btn.dataset.talla);
  });

  // Delegación de eventos en carrusel de ofertas y productos relacionados
  const manejarClickTarjetaDetalle = (e) => {
    const target = e.target.closest('[data-action="detalle"]');
    if (!target || !target.dataset.id) return;
    abrirDetalleProducto(target.dataset.id);
  };
  document.getElementById('carruselOfertas')?.addEventListener('click', manejarClickTarjetaDetalle);
  document.getElementById('gridRelacionados')?.addEventListener('click', manejarClickTarjetaDetalle);

  // Delegación de eventos en paginación (cambio de hoja)
  document.getElementById('paginacionCatalogo')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-page]');
    if (!btn || btn.disabled) return;
    const p = parseInt(btn.dataset.page, 10);
    if (!Number.isNaN(p) && p >= 1) irAPagina(p);
  });

  // Cerrar desplegables de categorías, marcas y tallas al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#dropdownCategorias') && !e.target.closest('#dropdownMarcas') && !e.target.closest('#dropdownTallas')) {
      cerrarMenusDesplegables();
    }
  });

  // Delegación de eventos en cuadrícula de productos (100% seguro contra comillas/caracteres)
  document.getElementById('gridProductos')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const { action, id } = target.dataset;
    if (!id) return;
    if (action === 'favorito') {
      e.stopPropagation();
      toggleFavorito(id, target);
    } else if (action === 'detalle') {
      abrirDetalleProducto(id);
    } else if (action === 'agregar') {
      agregarAlCarritoAccionDirecta(id);
    }
  });

  // Delegación de eventos en el carrito
  const cartList = document.getElementById('cartItemsList');
  cartList?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, clave } = btn.dataset;
    if (action === 'menos') cambiarCantidad(clave, -1);
    else if (action === 'mas') cambiarCantidad(clave, 1);
    else if (action === 'eliminar') eliminarItemCarrito(clave);
  });
  cartList?.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-action="modalidad"]');
    if (!sel) return;
    cambiarModalidadItem(sel.dataset.clave, sel.value);
  });

  // Swipe táctil en visor de fotos del modal
  const visor = document.getElementById('contenedorVisor');
  visor?.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      pausarPaseAutomatico();
    }
  }, { passive: true });

  visor?.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1 && fotosModalActuales.length > 1) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        cambiarFotoRelativa(dx < 0 ? 1 : -1);
        return;
      }
    }
    iniciarPaseAutomatico();
  }, { passive: true });

  // Botón "Atrás" del navegador/móvil cierra modal o carrito
  window.addEventListener('popstate', () => {
    const modal = document.getElementById('modalDetalle');
    const drawer = document.getElementById('cartDrawer');
    if (modal && !modal.classList.contains('hidden')) {
      cerrarDetalle(true);
    } else if (drawer && !drawer.classList.contains('translate-x-full')) {
      toggleCarrito(false, true);
    }
  });

  // Aviso de retorno si hay productos pendientes en carrito
  if (carrito.length > 0 && !sessionStorage.getItem('maviko_banner_descartado')) {
    setTimeout(() => {
      document.getElementById('bannerCarritoPendiente')?.classList.remove('hidden');
    }, 2500);
  }

  // Atajo Escape para cerrar modales y desplegables
  document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
      cerrarMenusDesplegables();
      cerrarDetalle();
      toggleCarrito(false);
      toggleQRModal(false);
      toggleModalPedidos(false);
      toggleClubVIP(false);
      toggleEncargoExterno(false);
      toggleModalInstalar(false);
      toggleGuiaTallas(false);
    }
  });
});
