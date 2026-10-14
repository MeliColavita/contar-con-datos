// ============================================================
// MODULO3.JS — "EL FUTURO" (Capítulo 3) — Meli — prefijo: me-
// ============================================================
// 1) Botón "Final": pausa el video 3, oculta su fundido y reproduce
//    04_FINAL.mp4 desde el principio (si se vuelve a tocar, reinicia).
//    Con la frase final se va el título del capítulo y, a los 4 s, aparece "Volver a comenzar".
//    Al cambiar de capítulo con el menú, script.js pausa y oculta el video 4.
// 2) Pestaña 3: buscador de mamógrafos con animación de puntos (más abajo).
//    Necesita buscador-datos.js cargado ANTES que este archivo.
// ============================================================
(function () {
  const bFinal = document.getElementById('me-final');
  const video3 = document.querySelector('.chapter-video[data-chapter="3"]');
  const video4 = document.getElementById('me-video4');
  if (!bFinal || !video3 || !video4) return;

  // Cierre: la tarjeta se desvanece y aparece la frase final (misma animación que el título de la intro)
  const card = bFinal.closest('.me-card');
  const cierre = document.getElementById('me-cierre');
  const partes = card
    ? card.querySelectorAll(
        ':scope > .ui-card-title, :scope > .ui-sub, :scope > .me-prompt-donde, :scope > .me-body, :scope > .me-final, :scope > .ui-src',
      )
    : [];

  // Pantalla final: aparece la frase y se va el título del capítulo ("Capítulo 3 /
  // El futuro"). A los 4 segundos de la frase aparece, discreto y abajo, el botón
  // "Volver a comenzar": al tocarlo todo se desvanece y se vuelve al inicio
  // (recarga la página: vuelve a la intro sin tocar script.js).
  const BOTON_MS = 3000; // 0,8 s de espera de la frase + 4 s con la frase en pantalla
  const REDUCIDO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const navBack = document.getElementById('navBack'); // botón fijo "Volver a la presentación"
  const capitulo = card ? card.closest('.chapter') : null;
  let tBoton = null;

  function mostrarCierre() {
    if (!card || !cierre) return;
    clearTimeout(tBoton);
    card.classList.add('me-cierre-on');
    if (capitulo) capitulo.classList.add('me-cierre-on'); // oculta "Capítulo 3 / El futuro"
    partes.forEach((el) => {
      el.inert = true; // sin foco ni lectores de pantalla en lo que se ocultó
    });
    cierre.hidden = false;
    void cierre.offsetWidth; // para que la transición arranque
    cierre.classList.add('on');
    if (navBack) navBack.classList.add('nav-back--glow'); // enciende "Volver a la presentación" junto con la frase
  }

  function ocultarCierre() {
    if (!card || !cierre) return;
    clearTimeout(tBoton);
    cierre.classList.remove('on');
    cierre.hidden = true;
    card.classList.remove('me-cierre-on');
    if (capitulo) capitulo.classList.remove('me-cierre-on');
    if (navBack) navBack.classList.remove('nav-back--glow');
    partes.forEach((el) => {
      el.inert = false;
    });
  }

  bFinal.onclick = () => {
    video3.pause();
    video3.classList.remove('active');
    video4.classList.add('active');
    video4.currentTime = 0;
    video4.play().catch((err) => console.warn('No se pudo reproducir 04_FINAL:', err));
    mostrarCierre();
  };
  // Al cambiar de capítulo, script.js oculta el video 4: se restaura la tarjeta
  new MutationObserver(() => {
    if (!video4.classList.contains('active')) ocultarCierre();
  }).observe(video4, { attributes: true, attributeFilter: ['class'] });
})();

// ============================================================
// BUSCADOR DE MAMÓGRAFOS (pestaña 3) — Meli — prefijo: me-
// ============================================================
// QUÉ HACE: el usuario escribe su localidad, elige una sugerencia y:
//   1. los puntos del lazo rosa (símbolo de la lucha contra el cáncer de
//      mama) se dispersan, vuelan y se vuelven a armar como lazo;
//   2. el lazo se deshace: quedan encendidos tantos puntos como mamógrafos
//      hay en esa localidad (el resto se desvanece hacia el centro);
//   3. cada punto es un mamógrafo: al pasar el mouse / tocar un punto se
//      resalta su tarjeta en la lista, y al revés (hover/foco en la tarjeta
//      resalta el punto).
//   Punto lleno = establecimiento Público · Anillo = Privado.
//   Si la localidad NO tiene mamógrafo (buscador-sin-mamografo.js), el lazo
//   se deshace en dos puntos —tu localidad y la más cercana con mamógrafo—,
//   unidos por una línea con la distancia aproximada, y un botón lleva a
//   los mamógrafos de esa localidad cercana.
//
// DATOS: MAMOGRAFOS (buscador-datos.js, generado por convertir_datos.py).
//        Ese archivo tiene que cargarse ANTES que este (ver index.html).
//        SIN_MAMOGRAFO (buscador-sin-mamografo.js, generado por
//        convertir_sin_mamografo.py): este archivo lo carga solo, después;
//        si no está, el buscador funciona igual, solo con las localidades de la base.
// ACCESIBILIDAD: el canvas es decorativo; la lista de la derecha tiene todo
//   el contenido (se navega con Tab) y se anuncia con aria-live. Con
//   "reducir movimiento" activado no hay animación: los puntos aparecen
//   directo en su lugar final.
// Todo texto de la base se inserta con textContent (nunca innerHTML).
// ============================================================
(function () {
  const input = document.getElementById('me-search-input');
  const stage = document.getElementById('me-stage');
  const canvas = document.getElementById('me-canvas');
  const panel = document.getElementById('me-tabpanel-3');
  if (!input || !stage || !canvas || !panel || typeof MAMOGRAFOS === 'undefined') return;

  const lista = document.getElementById('me-suggest');
  const clear = document.getElementById('me-search-clear');
  const result = document.getElementById('me-result');
  const prompt = document.getElementById('me-finder-prompt');
  const tip = document.getElementById('me-tip');
  const ctx = canvas.getContext('2d');
  const REDUCIDO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MAX_SUGERENCIAS = 8;

  // ============================================================
  // 1) BÚSQUEDA CON PREDICCIÓN (igual que el prototipo buscador.js)
  // ============================================================
  // "Córdoba" -> "cordoba": para comparar sin importar tildes ni mayúsculas
  function norm(s) {
    return String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  const localidades = MAMOGRAFOS.map((g) => ({
    localidad: g.localidad,
    provincia: g.provincia,
    items: g.items,
    claves: [norm(g.localidad)].concat((g.alias || []).map(norm)),
  }));

  // Localidades SIN mamógrafo: se cargan aparte (archivo grande) y se suman a la búsqueda
  function incorporarSin() {
    if (typeof SIN_MAMOGRAFO === 'undefined') return;
    const provs = SIN_MAMOGRAFO.provincias;
    SIN_MAMOGRAFO.filas.forEach((f) => {
      localidades.push({
        sin: true,
        localidad: f[0],
        depto: f[1],
        provincia: provs[f[2]],
        cercana: f[3],
        cercanaProv: provs[f[4]],
        km: f[5],
        destino: f[6] === 1 ? f[3] : f[6], // nombre de la localidad cercana en la base (0 = no se encontró)
        claves: [norm(f[0])],
      });
    });
    // si ya estaba escribiendo, se actualizan las sugerencias con lo nuevo
    if (document.activeElement === input && input.value && !actual) mostrarLista(input.value);
  }
  function cargarSin() {
    if (typeof SIN_MAMOGRAFO !== 'undefined') {
      incorporarSin();
      return;
    }
    const sc = document.createElement('script');
    sc.src = 'buscador-sin-mamografo.js';
    sc.onload = incorporarSin;
    sc.onerror = () => {}; // sin ese archivo el buscador sigue andando
    document.head.appendChild(sc);
  }

  // Hasta MAX_SUGERENCIAS localidades que coinciden. Orden: la que se escribió
  // exacta, después las que EMPIEZAN con lo escrito, después las que lo contienen;
  // en cada grupo, primero las que tienen mamógrafo, y por último alfabético.
  function buscar(texto) {
    const q = norm(texto);
    if (!q) return [];
    const hallados = [];
    localidades.forEach((l) => {
      const pos = l.claves.map((c) => c.indexOf(q)).filter((p) => p >= 0);
      if (!pos.length) return;
      const exacta = l.claves.some((c) => c === q);
      hallados.push({ l, grupo: exacta ? 0 : Math.min(...pos) === 0 ? 1 : 2 });
    });
    hallados.sort(
      (a, b) =>
        a.grupo - b.grupo ||
        (a.l.sin ? 1 : 0) - (b.l.sin ? 1 : 0) ||
        a.l.localidad.localeCompare(b.l.localidad, 'es') ||
        a.l.provincia.localeCompare(b.l.provincia, 'es'),
    );
    return hallados.slice(0, MAX_SUGERENCIAS).map((h) => h.l);
  }

  let sugeridas = [];
  let activo = -1; // posición resaltada con el teclado

  // Mueve el scroll de una lista para que "li" quede visible, SIN usar
  // scrollIntoView (que podría mover contenedores de afuera, como .chapter)
  function verEnLista(ul, li) {
    const arriba = li.offsetTop;
    const abajo = arriba + li.offsetHeight;
    if (arriba < ul.scrollTop) ul.scrollTop = Math.max(0, arriba - 4);
    else if (abajo > ul.scrollTop + ul.clientHeight) ul.scrollTop = abajo - ul.clientHeight + 4;
  }

  function cerrarLista() {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activo = -1;
  }

  // Escribe el nombre de la localidad resaltando lo que se tipeó
  function nombreResaltado(el, nombre, q) {
    const i = norm(nombre).indexOf(norm(q));
    if (i < 0 || !q.trim()) {
      el.textContent = nombre;
      return;
    }
    const fin = i + q.trim().length;
    el.appendChild(document.createTextNode(nombre.slice(0, i)));
    const s = document.createElement('strong');
    s.textContent = nombre.slice(i, fin);
    el.appendChild(s);
    el.appendChild(document.createTextNode(nombre.slice(fin)));
  }

  function mostrarLista(texto) {
    sugeridas = buscar(texto);
    lista.textContent = '';
    if (!texto.trim()) {
      cerrarLista();
      return;
    }
    if (sugeridas.length === 0) {
      const li = document.createElement('li');
      li.className = 'me-suggest-empty';
      li.textContent = 'No encontramos esa localidad en la base.';
      lista.appendChild(li);
    } else {
      sugeridas.forEach((l, i) => {
        const li = document.createElement('li');
        li.id = 'me-opt-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        const nombre = document.createElement('span');
        nombreResaltado(nombre, l.localidad, texto);
        const prov = document.createElement('small');
        prov.textContent = l.sin ? l.depto + ' · ' + l.provincia : l.provincia;
        li.appendChild(nombre);
        li.appendChild(prov);
        // mousedown (no click): se dispara antes de que el input pierda el foco
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          elegir(l);
        });
        lista.appendChild(li);
      });
    }
    activo = -1;
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function resaltar(pos) {
    const opts = lista.querySelectorAll('[role="option"]');
    if (!opts.length) return;
    activo = (pos + opts.length) % opts.length; // da la vuelta al llegar al borde
    opts.forEach((o, i) => o.setAttribute('aria-selected', i === activo));
    input.setAttribute('aria-activedescendant', opts[activo].id);
    verEnLista(lista, opts[activo]);
  }

  // ============================================================
  // 2) LAZO DE PUNTOS: geometría
  // ============================================================
  // El lazo se define con curvas de Bézier en un espacio de ~100 x 118
  // unidades. Cada trazo es una lista de curvas [p0, p1, p2, p3].
  // Después se "siembran" puntos a lo largo de cada trazo, en 3 filas
  // paralelas, para darle grosor.
  const LAZO_CX = 50; // centro del lazo en ese espacio (para centrarlo en el canvas)
  const LAZO_CY = 59;
  const LAZO_ALTO = 106; // alto real del dibujo (de y=6 a y=112)
  const LAZO_ANCHO = 58;
  const TRAZOS = [
    // el óvalo de arriba (dos mitades que se cruzan en el centro)
    [
      [
        [50, 62],
        [20, 46],
        [18, 6],
        [50, 6],
      ],
      [
        [50, 6],
        [82, 6],
        [80, 46],
        [50, 62],
      ],
    ],
    // las dos "colitas"
    [
      [
        [50, 62],
        [44, 78],
        [30, 92],
        [22, 112],
      ],
    ],
    [
      [
        [50, 62],
        [56, 78],
        [70, 92],
        [78, 112],
      ],
    ],
  ];

  function puntoBezier(c, t) {
    const u = 1 - t;
    const a = u * u * u,
      b = 3 * u * u * t,
      d = 3 * u * t * t,
      e = t * t * t;
    return [
      a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0],
      a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1],
    ];
  }

  // Devuelve [{ux, uy}] (posiciones del lazo, centradas en 0,0, en unidades)
  function generarLazo() {
    const PASO = 4.2; // distancia entre puntos a lo largo del trazo
    const FILAS = [-3.4, 0, 3.4]; // desplazamientos laterales (grosor)
    const out = [];
    TRAZOS.forEach((curvas) => {
      const pts = [];
      curvas.forEach((c) => {
        for (let i = 0; i <= 40; i++) pts.push(puntoBezier(c, i / 40));
      });
      let largo = 0;
      const acum = [0];
      for (let i = 1; i < pts.length; i++) {
        largo += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        acum.push(largo);
      }
      let seg = 1;
      for (let s = 0; s <= largo; s += PASO) {
        while (seg < pts.length - 1 && acum[seg] < s) seg++;
        const a = pts[seg - 1],
          b = pts[seg];
        const f = (s - acum[seg - 1]) / (acum[seg] - acum[seg - 1] || 1);
        const x = a[0] + (b[0] - a[0]) * f;
        const y = a[1] + (b[1] - a[1]) * f;
        const tx = b[0] - a[0],
          ty = b[1] - a[1];
        const m = Math.hypot(tx, ty) || 1;
        const nx = -ty / m,
          ny = tx / m; // normal del trazo
        FILAS.forEach((off) => {
          const px = x + nx * off,
            py = y + ny * off;
          // sin puntos pegados (donde los trazos se cruzan)
          if (out.some((o) => Math.hypot(o.ux - (px - LAZO_CX), o.uy - (py - LAZO_CY)) < 2.8))
            return;
          out.push({ ux: px - LAZO_CX, uy: py - LAZO_CY });
        });
      }
    });
    return out;
  }

  // ============================================================
  // 3) PARTÍCULAS
  // ============================================================
  // Colores: salen de las variables de :root (style.css); con respaldo.
  function leerColor(variable, respaldo) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    let m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m)
      return [
        parseInt(m[1].slice(0, 2), 16),
        parseInt(m[1].slice(2, 4), 16),
        parseInt(m[1].slice(4, 6), 16),
      ];
    m = /^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(v);
    if (m) return [+m[1], +m[2], +m[3]];
    return respaldo;
  }
  const COL_PUBLICO = leerColor('--rose-strong', [255, 111, 156]);
  const COL_PRIVADO = leerColor('--text-dim', [169, 154, 166]);
  const parts = generarLazo().map((u) => ({
    ux: u.ux,
    uy: u.uy, // posición en el lazo (unidades)
    x: 0,
    y: 0,
    vx: 0,
    vy: 0, // posición y velocidad actuales (px)
    rx: 0,
    ry: 0, // posición en el lazo (px, se recalcula al cambiar el tamaño)
    cx: 0,
    cy: 0, // posición en la constelación (px)
    tx: 0,
    ty: 0, // destino actual
    a: 0,
    ta: 0, // opacidad actual / destino
    r: 2,
    tr: 2, // radio actual / destino
    col: COL_PUBLICO.slice(),
    tcol: COL_PUBLICO.slice(),
    ring: 0,
    tring: 0, // 0 = punto lleno (público), 1 = anillo (privado)
    k: -1, // índice del mamógrafo que representa (-1 = ninguno)
    pend: null,
    at: 0, // destino programado y cuándo se aplica (escalonado)
    fase: Math.random() * 6.28, // para el titileo
  }));
  const ordenArriba = parts.map((p, i) => i).sort((a, b) => parts[a].uy - parts[b].uy);

  let W = 0,
    H = 0; // tamaño del canvas en px CSS
  let escala = 1; // unidades -> px del lazo
  let rLazo = 2; // radio de cada punto en el lazo
  let modo = 'lazo'; // 'lazo' o 'const' (constelación de mamógrafos)
  let actual = null; // localidad elegida
  let vivos = []; // partículas que representan mamógrafos (en orden de la lista)
  let hoverK = -1; // mamógrafo resaltado
  let mx = null,
    my = null; // puntero sobre el canvas
  let plan = []; // acciones programadas [{at, fn}]
  let entro = false; // ¿ya hizo la entrada inicial?
  let cerca = null; // modo 'cerca': {a: punto "tu localidad", b: punto "la más cercana", l}
  let tCerca = 0; // cuándo se armó (para que la línea aparezca después de los puntos)
  const FUENTE = getComputedStyle(stage).fontFamily || 'system-ui, sans-serif';

  function despues(ms, fn) {
    plan.push({ at: performance.now() + ms, fn });
  }

  function programar(p, d, demora) {
    p.pend = d;
    p.at = performance.now() + (REDUCIDO ? 0 : demora);
    if (REDUCIDO) aplicar(p, true);
  }
  function aplicar(p, snap) {
    const d = p.pend;
    if (!d) return;
    p.tx = d.x;
    p.ty = d.y;
    p.ta = d.a;
    p.tr = d.r;
    p.tcol = d.col;
    p.tring = d.ring;
    p.pend = null;
    if (snap) {
      p.x = d.x;
      p.y = d.y;
      p.a = d.a;
      p.r = d.r;
      p.col = d.col.slice();
      p.ring = d.ring;
      p.vx = p.vy = 0;
    }
  }

  // Calcula tamaño del lazo según el canvas
  function medirLazo() {
    escala = Math.min((H * 0.9) / LAZO_ALTO, (W * 0.72) / LAZO_ANCHO);
    rLazo = Math.max(1.6, Math.min(3.4, escala * 1.25));
    parts.forEach((p) => {
      p.rx = W / 2 + p.ux * escala;
      p.ry = H / 2 + p.uy * escala;
    });
  }

  // Posiciones de la constelación: girasol (espiral áurea), un poco achatado
  // para aprovechar un canvas más ancho que alto. Devuelve también el radio de punto.
  function medirConstelacion() {
    const n = vivos.length;
    if (!n) return;
    const ryMax = H / 2 - 18,
      rxMax = W / 2 - 18;
    const base = 28 * Math.sqrt(n) * 0.72; // más mamógrafos => más grande, hasta el borde
    const ry = Math.min(base, ryMax),
      rx = Math.min(base * 1.25, rxMax);
    const sep = (1.77 * Math.min(rx, ry)) / Math.sqrt(n);
    const radio = n === 1 ? 9 : Math.max(3.2, Math.min(7.5, sep * 0.26));
    vivos.forEach((p, k) => {
      const f = Math.sqrt((k + 0.5) / n);
      const ang = k * 2.399963;
      p.cx = W / 2 + Math.cos(ang) * f * rx;
      p.cy = H / 2 + Math.sin(ang) * f * ry;
      p.cr = radio;
    });
  }

  // ----- Las tres "escenas" de la animación -----
  // a) dispersar: cada punto sale volando a un lugar al azar
  function dispersar() {
    parts.forEach((p) =>
      programar(
        p,
        {
          x: Math.random() * W,
          y: Math.random() * H,
          a: 0.95,
          r: rLazo * 1.2,
          col: COL_PUBLICO,
          ring: 0,
        },
        Math.random() * 90,
      ),
    );
  }
  // b) lazo: vuelven a armarse (de arriba hacia abajo, como si se dibujara)
  function armarLazo(brillo, escalonado) {
    ordenArriba.forEach((i, orden) => {
      const p = parts[i];
      p.k = -1;
      programar(
        p,
        { x: p.rx, y: p.ry, a: brillo, r: rLazo, col: COL_PUBLICO, ring: 0 },
        escalonado ? (orden / parts.length) * 420 + Math.random() * 100 : Math.random() * 150,
      );
    });
  }
  // c) constelación: quedan N puntos (los demás se desvanecen hacia el centro)
  function armarConstelacion(items) {
    const n = Math.min(items.length, parts.length);
    const elegidos = new Set();
    vivos = [];
    for (let k = 0; k < n; k++) {
      const i = Math.floor(((k + 0.5) * parts.length) / n); // repartidos por todo el lazo
      elegidos.add(i);
      parts[i].k = k;
      vivos.push(parts[i]);
    }
    medirConstelacion();
    parts.forEach((p, i) => {
      if (elegidos.has(i)) {
        const privado = norm(items[p.k].tipo || '') === 'privado';
        programar(
          p,
          {
            x: p.cx,
            y: p.cy,
            a: 1,
            r: p.cr,
            col: privado ? COL_PRIVADO : COL_PUBLICO,
            ring: 0,
          },
          Math.random() * 260,
        );
      } else {
        p.k = -1;
        programar(
          p,
          {
            x: W / 2 + (Math.random() - 0.5) * 24,
            y: H / 2 + (Math.random() - 0.5) * 24,
            a: 0,
            r: 0,
            col: COL_PUBLICO,
            ring: 0,
          },
          Math.random() * 200,
        );
      }
    });
    modo = 'const';
  }

  // d) cerca: la localidad NO tiene mamógrafo -> quedan 2 puntos: "tu localidad"
  //    (anillo tenue) y "la más cercana con mamógrafo" (punto lleno). No están
  //    a escala: la distancia real va escrita sobre la línea.
  function armarCerca(l, rapido) {
    const i1 = Math.floor(parts.length * 0.3),
      i2 = Math.floor(parts.length * 0.7);
    const y = H * 0.44;
    parts.forEach((p, i) => {
      p.k = -1;
      if (i === i1)
        programar(
          p,
          { x: W * 0.24, y, a: 0.6, r: 8, col: COL_PRIVADO, ring: 0 },
          rapido ? 0 : Math.random() * 120,
        );
      else if (i === i2)
        programar(
          p,
          { x: W * 0.76, y, a: 1, r: 9, col: COL_PUBLICO, ring: 0 },
          rapido ? 0 : Math.random() * 120,
        );
      else
        programar(
          p,
          {
            x: W / 2 + (Math.random() - 0.5) * 24,
            y: y + (Math.random() - 0.5) * 24,
            a: 0,
            r: 0,
            col: COL_PUBLICO,
            ring: 0,
          },
          rapido ? 0 : Math.random() * 200,
        );
    });
    vivos = [];
    cerca = { a: parts[i1], b: parts[i2], l };
    if (!rapido) tCerca = performance.now();
    modo = 'cerca';
  }

  // ============================================================
  // 4) ELEGIR / LIMPIAR
  // ============================================================
  function elegir(l) {
    if (l.sin) elegirSin(l);
    else elegirConMamografo(l);
  }

  // Botón "Ver mamógrafos en X" (de una localidad sin mamógrafo)
  function irADestino(l) {
    const nombre = norm(l.destino);
    const prov = l.cercanaProv;
    const dest = localidades.find(
      (x) => !x.sin && x.provincia === prov && x.claves.some((c) => c === nombre),
    );
    if (dest) elegirConMamografo(dest);
  }

  function elegirSin(l) {
    input.value = l.localidad;
    clear.hidden = false;
    cerrarLista();
    actual = l;
    cerca = null;
    setHover(-1);
    dibujarSin(l);
    stage.setAttribute(
      'aria-label',
      l.localidad +
        ' no tiene mamógrafo en la base. El más cercano está en ' +
        l.cercana +
        ', a unos ' +
        fmtKm(l.km) +
        ' km.',
    );
    plan = [];
    modo = 'lazo';
    vivos = [];
    if (W > 0) {
      dispersar();
      despues(REDUCIDO ? 0 : 420, () => armarLazo(1, true));
      despues(REDUCIDO ? 0 : 1450, () => armarCerca(l, false));
      if (REDUCIDO) {
        plan.forEach((a) => a.fn());
        plan = [];
        dibujar(performance.now());
      }
    }
  }

  function elegirConMamografo(l) {
    input.value = l.localidad;
    clear.hidden = false;
    cerrarLista();
    actual = l;
    cerca = null;
    setHover(-1);
    dibujarResultado(l);
    stage.setAttribute(
      'aria-label',
      l.items.length +
        (l.items.length === 1 ? ' mamógrafo' : ' mamógrafos') +
        ' en ' +
        l.localidad +
        ': un punto por cada uno.',
    );

    plan = [];
    modo = 'lazo';
    vivos = [];
    if (W > 0) {
      dispersar();
      despues(REDUCIDO ? 0 : 420, () => armarLazo(1, true));
      despues(REDUCIDO ? 0 : 1450, () => armarConstelacion(l.items));
      if (REDUCIDO) {
        plan.forEach((a) => a.fn());
        plan = [];
        dibujar(performance.now());
      }
    }
  }

  function limpiar() {
    input.value = '';
    clear.hidden = true;
    actual = null;
    cerca = null;
    result.hidden = true;
    result.textContent = '';
    prompt.hidden = false;
    cerrarLista();
    setHover(-1);
    plan = [];
    modo = 'lazo';
    vivos = [];
    stage.setAttribute(
      'aria-label',
      'Lazo rosa hecho de puntos. Elegí una localidad para ver sus mamógrafos.',
    );
    if (W > 0) {
      armarLazo(0.6, true);
      if (REDUCIDO) dibujar(performance.now());
    }
    input.focus();
  }

  function fmtKm(km) {
    return km >= 10 ? String(Math.round(km)) : km.toFixed(1).replace('.', ',');
  }

  // ----- Resultado de una localidad SIN mamógrafo (a la derecha) -----
  function dibujarSin(l) {
    prompt.hidden = true;
    result.textContent = '';

    const t = document.createElement('h3');
    t.className = 'me-result-title';
    t.appendChild(document.createTextNode('Sin mamógrafo en ' + l.localidad));
    const prov = document.createElement('span');
    prov.textContent = ' · ' + l.provincia;
    t.appendChild(prov);
    result.appendChild(t);

    const p = document.createElement('p');
    p.className = 'me-sin-texto';
    p.appendChild(document.createTextNode('El mamógrafo más cercano está en '));
    const b = document.createElement('b');
    b.textContent = l.cercana;
    p.appendChild(b);
    p.appendChild(
      document.createTextNode(l.cercanaProv !== l.provincia ? ' (' + l.cercanaProv + ')' : ''),
    );
    p.appendChild(document.createTextNode(', a unos ' + fmtKm(l.km) + ' km en línea recta.'));
    result.appendChild(p);

    if (l.destino) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'me-btn me-sin-btn';
      btn.textContent = 'Ver mamógrafos en ' + l.cercana;
      btn.addEventListener('click', () => irADestino(l));
      result.appendChild(btn);
    }

    const nota = document.createElement('p');
    nota.className = 'ui-note me-sin-nota';
    nota.textContent =
      'Distancia aproximada entre los centros de las dos localidades; no refleja el tiempo de viaje.';
    result.appendChild(nota);
    result.hidden = false;
  }

  // ----- Lista de resultados (a la derecha) -----
  function dibujarResultado(l) {
    prompt.hidden = true;
    result.textContent = '';
    const n = l.items.length;

    const t = document.createElement('h3');
    t.className = 'me-result-title';
    t.appendChild(
      document.createTextNode(
        n === 1 ? 'Mamógrafo en ' + l.localidad : n + ' mamógrafos en ' + l.localidad,
      ),
    );
    const prov = document.createElement('span');
    prov.textContent = ' · ' + l.provincia;
    t.appendChild(prov);
    result.appendChild(t);

    const ul = document.createElement('ul');
    ul.className = 'me-result-list';
    l.items.forEach((m, k) => {
      const li = document.createElement('li');
      li.className = 'me-result-item';
      li.tabIndex = 0;
      li.dataset.k = k;
      const privado = norm(m.tipo || '') === 'privado';
      li.dataset.tipo = privado ? 'privado' : 'publico';
      li.style.animationDelay = Math.min(k, 14) * 45 + 'ms'; // entran en cascada

      const b = document.createElement('b');
      const pip = document.createElement('i'); // mismo símbolo que el punto: lleno = público, punto gris = privado
      pip.className = 'me-pip' + (privado ? ' me-ring' : '');
      pip.setAttribute('aria-hidden', 'true');
      b.appendChild(pip);
      b.appendChild(document.createTextNode(m.establecimiento));
      li.appendChild(b);
      // una línea por dato (si falta, no se muestra): dirección / tipo y detalle / teléfono
      [
        m.direccion,
        [m.tipo, m.detalle].filter(Boolean).join(' · '),
        m.telefono && 'Tel: ' + m.telefono,
      ]
        .filter(Boolean)
        .forEach((txt) => {
          const s = document.createElement('span');
          s.textContent = txt;
          li.appendChild(s);
        });

      li.addEventListener('mouseenter', () => setHover(k, false));
      li.addEventListener('focus', () => setHover(k, false));
      li.addEventListener('mouseleave', () => setHover(-1));
      li.addEventListener('blur', () => setHover(-1));
      ul.appendChild(li);
    });
    result.appendChild(ul);

    result.hidden = false;
  }

  // ============================================================
  // 5) INTERACCIÓN punto <-> tarjeta
  // ============================================================
  function setHover(k, desdeCanvas) {
    if (k === hoverK) return;
    hoverK = k;
    const items = result.querySelectorAll('.me-result-item');
    items.forEach((li) => li.classList.toggle('me-hl', +li.dataset.k === k));
    if (k >= 0 && desdeCanvas && items[k]) verEnLista(items[k].parentNode, items[k]);
    if (k < 0) tip.hidden = true;
    else if (actual) {
      const m = actual.items[k];
      tip.textContent = m.establecimiento;
      tip.hidden = false;
    }
    if (REDUCIDO) dibujar(performance.now());
  }

  // Punto más cercano al puntero (solo con la constelación armada)
  function puntoCerca(x, y) {
    if (modo !== 'const') return -1;
    let mejor = -1,
      dMejor = 1e9;
    vivos.forEach((p) => {
      if (p.a < 0.5) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < Math.max(p.r + 9, 14) && d < dMejor) {
        dMejor = d;
        mejor = p.k;
      }
    });
    return mejor;
  }
  function posPuntero(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  canvas.addEventListener('pointermove', (e) => {
    [mx, my] = posPuntero(e);
    setHover(puntoCerca(mx, my), true);
    canvas.style.cursor = hoverK >= 0 ? 'pointer' : '';
  });
  canvas.addEventListener('pointerdown', (e) => {
    // táctil: tocar un punto lo resalta
    [mx, my] = posPuntero(e);
    setHover(puntoCerca(mx, my), true);
  });
  canvas.addEventListener('pointerleave', (e) => {
    mx = my = null;
    if (e.pointerType === 'mouse') setHover(-1);
  });

  // ============================================================
  // 6) ANIMACIÓN (resortes) Y DIBUJO
  // ============================================================
  const K = 90; // rigidez del resorte
  const C = 14; // amortiguación
  let ultimo = performance.now();

  function visible() {
    return W > 0 && H > 0 && panel.classList.contains('active');
  }

  function tick(t) {
    requestAnimationFrame(tick);
    if (!visible()) {
      ultimo = t;
      return;
    }
    if (REDUCIDO) return; // sin animación: se dibuja solo cuando cambia algo (ver dibujar())
    const dt = Math.min(0.033, (t - ultimo) / 1000 || 0.016);
    ultimo = t;

    // acciones programadas
    if (plan.length) {
      const ahora = performance.now();
      const listas = plan.filter((a) => a.at <= ahora);
      if (listas.length) {
        plan = plan.filter((a) => a.at > ahora);
        listas.forEach((a) => a.fn());
      }
    }

    const e = 1 - Math.exp(-dt * 7);
    const ahora = performance.now();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.pend && ahora >= p.at) aplicar(p, false);
      // resorte hacia el destino
      p.vx += ((p.tx - p.x) * K - p.vx * C) * dt;
      p.vy += ((p.ty - p.y) * K - p.vy * C) * dt;
      // el puntero "empuja" los puntos del lazo (en la constelación no, para poder tocarlos)
      if (modo === 'lazo' && mx !== null) {
        const dx = p.x - mx,
          dy = p.y - my,
          d = Math.hypot(dx, dy);
        if (d < 56 && d > 0.1) {
          const f = 1 - d / 56;
          p.vx += (dx / d) * f * f * 1100 * dt;
          p.vy += (dy / d) * f * f * 1100 * dt;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a += (p.ta - p.a) * e;
      p.r += (p.tr - p.r) * e;
      p.ring += (p.tring - p.ring) * e;
      p.col[0] += (p.tcol[0] - p.col[0]) * e;
      p.col[1] += (p.tcol[1] - p.col[1]) * e;
      p.col[2] += (p.tcol[2] - p.col[2]) * e;
    }
    dibujar(t);
  }

  // Acorta un texto con "…" para que entre en "max" px (con la fuente actual del canvas)
  function recortar(txt, max) {
    if (ctx.measureText(txt).width <= max) return txt;
    while (txt.length > 1 && ctx.measureText(txt + '…').width > max) txt = txt.slice(0, -1);
    return txt + '…';
  }

  function dibujar(t) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.a < 0.02 || p.r < 0.2) continue;
      let a = p.a,
        r = p.r;
      if (modo === 'lazo') a *= 0.86 + 0.14 * Math.sin(t / 650 + p.fase); // titileo suave
      const resalta = modo === 'const' && hoverK >= 0;
      if (resalta) {
        if (p.k === hoverK) r *= 1.6;
        else if (p.k >= 0) a *= 0.45;
      }
      const c = Math.round(p.col[0]) + ',' + Math.round(p.col[1]) + ',' + Math.round(p.col[2]);

      ctx.fillStyle = 'rgba(' + c + ',' + (a * 0.12).toFixed(3) + ')'; // resplandor
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.9, 0, 6.2832);
      ctx.fill();

      ctx.fillStyle = 'rgba(' + c + ',' + (a * (1 - p.ring * 0.82)).toFixed(3) + ')'; // cuerpo
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 6.2832);
      ctx.fill();
      if (p.ring > 0.02) {
        // anillo (privado)
        ctx.lineWidth = Math.max(1.4, r * 0.28);
        ctx.strokeStyle = 'rgba(' + c + ',' + (a * p.ring).toFixed(3) + ')';
        ctx.stroke();
      }
      if (resalta && p.k === hoverK) {
        // aro que late alrededor del punto resaltado
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(' + c + ',' + (0.55 + 0.3 * Math.sin(t / 180)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 6, 0, 6.2832);
        ctx.stroke();
      }
    }
    // modo "cerca": línea punteada con la distancia y el nombre de cada punto
    if (modo === 'cerca' && cerca) {
      const lt = REDUCIDO ? 1 : Math.max(0, Math.min(1, (t - tCerca - 800) / 500));
      const A = cerca.a,
        B = cerca.b;
      if (lt > 0 && A.a > 0.2 && B.a > 0.2) {
        ctx.save();
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = 'rgba(255,182,206,' + (0.55 * lt).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(A.x + A.r + 7, A.y);
        ctx.lineTo(B.x - B.r - 7, B.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(242,233,238,' + (0.95 * lt).toFixed(3) + ')';
        ctx.font = '600 13px ' + FUENTE;
        ctx.fillText('≈ ' + fmtKm(cerca.l.km) + ' km', (A.x + B.x) / 2, A.y - 10);
        ctx.font = '12px ' + FUENTE;
        ctx.fillStyle = 'rgba(169,154,166,' + lt.toFixed(3) + ')';
        ctx.fillText(recortar(cerca.l.localidad, W * 0.42), A.x, A.y + A.r + 22);
        ctx.fillStyle = 'rgba(242,233,238,' + lt.toFixed(3) + ')';
        ctx.fillText(recortar(cerca.l.cercana, W * 0.42), B.x, B.y + B.r + 22);
        ctx.restore();
      }
    }
    // etiqueta con el nombre del punto resaltado
    if (hoverK >= 0 && modo === 'const') {
      const p = vivos[hoverK];
      if (p) {
        const w = tip.offsetWidth;
        const x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, p.x));
        const arriba = p.y - p.r * 1.6 - 12 > tip.offsetHeight + 4;
        tip.style.left = x + 'px';
        tip.style.top = (arriba ? p.y - p.r * 1.6 - 12 : p.y + p.r * 1.6 + 12) + 'px';
        tip.style.transform = arriba ? 'translate(-50%,-100%)' : 'translate(-50%,0)';
      }
    }
  }

  // ============================================================
  // 7) TAMAÑO DEL CANVAS
  // ============================================================
  function ajustar() {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    if (!w || !h) return; // el capítulo está oculto: se reintenta cuando se muestre
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const primera = W === 0;
    W = w;
    H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    medirLazo();
    if (modo === 'const') {
      medirConstelacion();
      vivos.forEach((p) => {
        const d = actualDestino(p);
        programar(p, d, 0);
      });
    } else if (modo === 'cerca' && cerca) {
      armarCerca(cerca.l, true);
    } else if (!primera) {
      armarLazo(0.6, false);
    }
    if (REDUCIDO) dibujar(performance.now());
  }
  // destino de un punto vivo (mantiene su color/anillo, solo cambia la posición)
  function actualDestino(p) {
    return { x: p.cx, y: p.cy, a: 1, r: p.cr, col: p.tcol, ring: p.tring };
  }

  // Entrada: la primera vez que se ve la pestaña, el lazo se arma desde puntos sueltos
  function entrada() {
    parts.forEach((p) => {
      p.x = Math.random() * W;
      p.y = Math.random() * H;
      p.vx = p.vy = 0;
      p.a = 0;
      p.r = rLazo;
      p.tx = p.x;
      p.ty = p.y;
    });
    armarLazo(0.6, true);
    entro = true;
    if (REDUCIDO) dibujar(performance.now());
  }
  function revisarEntrada() {
    if (!entro && visible()) entrada();
  }

  new ResizeObserver(() => {
    ajustar();
    revisarEntrada();
  }).observe(stage);
  // la pestaña pasa a .active por script.js: se detecta el cambio de clase
  new MutationObserver(revisarEntrada).observe(panel, {
    attributes: true,
    attributeFilter: ['class'],
  });
  window.addEventListener('resize', ajustar);
  ajustar();
  revisarEntrada();
  requestAnimationFrame(tick);
  cargarSin();

  // ============================================================
  // 8) EVENTOS DEL BUSCADOR
  // ============================================================
  input.addEventListener('input', () => {
    clear.hidden = !input.value;
    mostrarLista(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (lista.hidden) mostrarLista(input.value);
      resaltar(activo + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      resaltar(activo - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Enter elige la resaltada; si no hay ninguna, la primera sugerencia
      const l = sugeridas[activo >= 0 ? activo : 0];
      if (!lista.hidden && l) elegir(l);
    } else if (e.key === 'Escape') cerrarLista();
  });
  input.addEventListener('blur', cerrarLista);
  input.addEventListener('focus', () => {
    if (input.value && !actual) mostrarLista(input.value);
  });
  clear.addEventListener('click', limpiar);
})();

// ---------- Fuente ----------
// Lo que muestra "Fuente" en este módulo (lo arma uiFuente, en script.js).
(function () {
  const src = document.querySelector('.me-card > .ui-src');
  if (!src) return;
  const FUENTES_ME = [
    {
      autor: 'INDEC (2022)',
      etiqueta: 'Localidades censales',
      url: 'https://datos.gob.ar/dataset/codigos-geograficos-del-indec-2022',
    },
    {
      autor: 'Surcos y Fundación Instituto Natura (2026)',
      etiqueta: 'Mapa mamográfico',
      url: 'https://surcos.org/web/mira/',
    },
  ];
  uiFuente(src, FUENTES_ME);
})();
