// ============================================================
// MODULO1.JS — Capítulo 1 "Argentina hoy" — Emi — prefijo: em-
// ============================================================
// QUÉ HACE ESTE ARCHIVO: dibuja los 3 gráficos de la tarjeta del
// Capítulo 1 y maneja las 2 pestañas que eligen cuál se ve:
//   - "Casos por tipo de cáncer": INTERACTIVO. El usuario arrastra
//     una barra para ADIVINAR cuánto cree que vale "Mama" antes de
//     ver el valor real (que crece animado + cuenta desde 0), y
//     después puede comparar "Mama" contra la suma de los otros 4
//     cánceres (animación de fusión/separación de columnas).
//   - "Casos por edad": INTERACTIVO. El usuario elige un rango de
//     edad (clic o arrastre sobre las barras, o 3 chips de acceso
//     rápido) y los 2 datos de abajo se recalculan en vivo.
//
// CÓMO ESTÁ ORGANIZADO (de arriba a abajo):
//   1. Guarda de entrada (si el HTML del módulo no está, no hace nada)
//   2. "reduceMotion" (leído de prefers-reduced-motion)
//   3. Herramientas genéricas (formatNumber, pctLabel, countUp)
//   4. Tooltip compartido (lo usan los 2 gráficos de barras)
//   5. Los datos del gráfico (números de GLOBOCAN 2024)
//   6. Las funciones que "renderizan" cada gráfico
//   7. El "despachador": qué función llamar según la pestaña activa
//   8. El arranque: conecta los clicks de las pestañas y hace el
//      primer dibujo apenas carga la página
//
// Todo el archivo vive adentro de una única función que se ejecuta
// sola -- una "IIFE" (Immediately Invoked Function Expression) -- así
// ninguna de las variables/funciones de acá queda visible para los
// otros módulos (modulo2.js, modulo3.js). Es la forma de que cada
// módulo tenga su propio "cajón" de JavaScript sin pisarse entre sí.
//
// NOTA PARA QUIEN LEA ESTE ARCHIVO DESPUÉS DE CONOCER UNA VERSIÓN
// VIEJA: antes "Casos por tipo" y "Casos por edad" se dibujaban con
// <svg> a mano (rects + escalas tipo d3, sin ninguna librería). Se
// sacó TODO ese mecanismo (svgEl, createChartSVG, scaleLinear,
// scaleBand, y los 2 renderBarChart*) porque las animaciones nuevas
// (arrastrar, clones "volando" de una columna a otra, una pila que se
// arma/desarma) son mucho más simples con <div> normales + Web
// Animations API (el.animate()) que con coordenadas SVG. También se sacó el breakpoint que pasaba "Casos por
// tipo" a barras horizontales en pantallas angostas (HORIZONTAL_
// BREAKPOINT): la interacción de arrastrar necesita que la barra sea
// SIEMPRE vertical, en cualquier ancho de pantalla.
// ============================================================
(function () {
  // root = el contenedor raíz de TODO el módulo (ver index.html:
  // <div class="ui-wrap em-wrap">). Si esta página no tiene ese div,
  // root va a ser "null" y cortamos acá mismo.
  const root = document.querySelector('.em-wrap');
  if (!root) return; // el módulo no está en la página

  // panel1 = el <div id="em-chart-panel"> vacío donde se dibuja el
  // gráfico que corresponda según la pestaña activa.
  const panel1 = root.querySelector('#em-chart-panel');
  if (!panel1) return;

  // emSrc = el acordeón "Fuente" (.ui-src), hijo directo de .em-card
  // -- VIVE AFUERA de #em-chart-panel (ver index.html), compartido
  // por las 3 pestañas. "Casos por tipo" lo mueve adentro suyo (al
  // pie, junto a la bajada) para que quede en la misma fila que el
  // subtítulo -- ver renderCasosPorTipo() y render1(), más abajo, que
  // se encargan de devolverlo a este lugar antes de vaciar el panel
  // con innerHTML='', para no perderlo.
  const emSrc = panel1.parentElement.querySelector('.ui-src');

  // ============================================================
  // 2. "REDUCIR MOVIMIENTO"
  // ============================================================
  // reduceMotion: preferencia de accesibilidad del sistema operativo
  // ("reducir movimiento"). Se lee UNA sola vez acá (la comparten
  // los 2 gráficos) y se usa para saltear tanto las animaciones CSS (ver modulo1.css, el
  // @media al final) como las armadas a mano con requestAnimationFrame
  // / el.animate() de este archivo.
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // 3. HERRAMIENTAS GENÉRICAS
  // ============================================================

  // formatNumber(n): 20750 -> "20.750" (separador de miles argentino).
  function formatNumber(n) {
    return new Intl.NumberFormat('es-AR').format(n);
  }

  // pctLabel(x): 0.602 -> "60,2" (1 decimal, coma argentina). Se usa
  // para los porcentajes de "Casos por edad".
  function pctLabel(x) {
    return (Math.round(x * 1000) / 10).toLocaleString('es-AR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  // countUp(el, to): escribe en "el" los números de 0 a "to", en unos
  // 600ms, dando la sensación de un contador sumando en vivo. Se usa
  // en los momentos en que un dato "se revela" (la respuesta real de
  // Mama, el total de los otros 4 cánceres sumados).
  function countUp(el, to) {
    if (reduceMotion) {
      el.textContent = formatNumber(to);
      return;
    }
    const t0 = performance.now();
    (function tick(t) {
      const p = Math.min(1, (t - t0) / 600);
      el.textContent = formatNumber(Math.round(to * p));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  // (Acá vivía animateIn(el): un fundido + desliz de 0,6s que
  // "Casos por tipo" y "Casos por edad" le aplicaban al panel cada vez
  // que se dibujaban. Se sacó porque al cambiar de pestaña se sumaba a
  // la animación .em-fade-in (la misma de módulo 2, ver animarEntrada()
  // al final del archivo) sobre el MISMO elemento: las 2 tiraban de la
  // opacidad y la posición a la vez, con duraciones distintas (0,35s y
  // 0,6s), y cuando terminaba la primera el panel pegaba un salto --
  // se veía "rota" (reportado por Emi). Ahora queda solo .em-fade-in,
  // igual que en módulo 2.)

  // ============================================================
  // 4. TOOLTIP COMPARTIDO
  // ============================================================
  // Un único globo flotante, reusado por "Casos por tipo" Y "Casos
  // por edad" (se crea una sola vez, se reposiciona/rellena en cada
  // hover). Vive en <body> -- no adentro de la tarjeta -- porque
  // puede aparecer sobre CUALQUIER barra o segmento de la pila, sin
  // importar qué tan abajo esté en la página. Mismo patrón que
  // .br-tooltip en módulo 2 (globo con fondo + borde, position
  // absolute siguiendo al mouse), adaptado a JS puro en vez de CSS
  // position:absolute relativo a un contenedor fijo.
  const tip = document.createElement('div');
  tip.className = 'em-tip';
  tip.hidden = true;
  document.body.appendChild(tip);

  function showTip(e, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    // Math.min(...): si el tooltip apareciera pegado al mouse cerca
    // del borde derecho de la pantalla, se saldría -- lo recorta para
    // que siempre quede adentro. Usa el ancho REAL del globo.
    const x = Math.max(8, Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8));
    tip.style.left = x + window.scrollX + 'px';
    tip.style.top = e.clientY + window.scrollY - 10 + 'px';
  }
  function hideTip() {
    tip.hidden = true;
  }
  // ============================================================
  // 5. DATOS (verificados contra el Excel de la fuente)
  // ============================================================
  // Fuente de TODOS los números de este módulo: GLOBOCAN 2024
  // (IARC/OMS) — archivo CancerGlobalMujeres2024.xlsx. Si algún día
  // cambia un número, se cambia ACÁ, en un solo lugar.

  // MAMA_MUJERES / CASOS_TOTALES_AMBOS_SEXOS: los 2 números del dato
  // "14,9%" de abajo. El total (139.470) es el de TODOS los cánceres en
  // Argentina 2024, hombres y mujeres, INCLUYENDO el cáncer de piel no
  // melanoma (GLOBOCAN publica también un total que lo excluye). El
  // numerador es mama EN MUJERES: el cáncer de mama también ocurre en
  // hombres.
  const MAMA_MUJERES = 20750;
  const CASOS_TOTALES_AMBOS_SEXOS = 139470;
  const CASOS_TOTALES_MUJERES = 69449;

  // chapter1Stats: los 2 datos sueltos que acompañan al gráfico
  // "Casos por tipo de cáncer" (no cambian con la interacción). El
  // segundo antes era "66,2 casos cada 100.000 mujeres" (la tasa sigue
  // estando en la etiqueta de cada barra); ahora es el peso del cáncer
  // de mama sobre TODOS los casos de cáncer del país (pedido de Emi).
  // El % se calcula acá, no se escribe a mano.
  const chapter1Stats = [
    { valor: '1°', label: 'Cáncer más frecuente en mujeres', clase: 'em-stat-primero' },
    {
      valor: pctLabel(MAMA_MUJERES / CASOS_TOTALES_MUJERES) + '%',
      label: 'de todos los cánceres en mujeres',
      clase: 'em-stat-pct-mujeres',
    },
    {
      valor: pctLabel(MAMA_MUJERES / CASOS_TOTALES_AMBOS_SEXOS) + '%',
      label: 'de todos los casos de cáncer en mujeres y hombres',
    },
  ];

  // TIPO_MAX / EDAD_MAX: techo del eje (en casos) que usa cada
  // gráfico de barras para calcular la altura -- antes era
  // "opts.maxValue" al llamar a renderBarChart; ahora, sin esa
  // función, quedan como constantes nombradas.
  const TIPO_MAX = 25000;
  // SUM_LABEL: texto del botón que junta los otros 4 cánceres en una
  // sola pila (antes "Ver los otros 4 juntos", pedido de Emi). Una sola
  // constante porque también lo nombra el mensaje de "Ver por separado".
  const SUM_LABEL = '¿Y si sumamos los otros 4?';
  // EDAD_MAX ya no es un número fijo (era 8000, después 7000): ahora
  // es el valor más alto de casosPorEdad (6.278, "60-74"), calculado
  // más abajo, después de chapter1Data. Así la barra más alta llega
  // justo al techo del gráfico y su número queda pegado arriba -- el
  // espacio entre la instrucción rosa y lo que se VE del gráfico es
  // exactamente el espacio parejo entre bloques (--ui-gap-titulo, ver
  // style.css). Con 7000 quedaba una franja vacía arriba de la barra
  // más alta que sumaba ~20px de más. Las barras siguen siendo
  // proporcionales entre sí.
  // (Acá vivía TIPO_PLACEHOLDER_PX, el alto de las 4 barras "vacías"
  // que se veían en "Casos por tipo" antes de revelar. Ya no hace
  // falta: ahora esas 4 columnas directamente NO se muestran hasta
  // confirmar la estimación -- ver .em-col-pending en modulo1.css.)

  const chapter1Data = {
    casosPorTipo: [
      { categoria: 'Mama', valor: 20750, tasa: 66.2 },
      { categoria: 'Colorrectal', valor: 7698, tasa: 20.5 },
      { categoria: 'Cuello uterino', valor: 4679, tasa: 16.5 },
      { categoria: 'Pulmón', valor: 4469, tasa: 12.5 },
      { categoria: 'Tiroides', valor: 3370, tasa: 12.4 },
    ],
    casosPorEdad: [
      { categoria: '15-29', valor: 549, desde: 15, hasta: 29 },
      { categoria: '30-44', valor: 3984, desde: 30, hasta: 44 },
      { categoria: '45-59', valor: 6213, desde: 45, hasta: 59 },
      { categoria: '60-74', valor: 6278, desde: 60, hasta: 74 },
      { categoria: '75 o más', valor: 3726, desde: 75, hasta: null },
    ],
  };

  // Techo del eje de "Casos por edad" = la barra más alta (ver el
  // comentario de EDAD_MAX, más arriba). Si cambian los datos, se
  // recalcula solo.
  const EDAD_MAX = Math.max.apply(
    null,
    chapter1Data.casosPorEdad.map(function (d) {
      return d.valor;
    }),
  );

  // tipoState / edadState: el estado de cada gráfico interactivo,
  // declarado FUERA de las funciones de render (así sobrevive a un
  // redibujado). Hace falta porque el panel se vuelve a dibujar de
  // cero cada vez que se cambia de pestaña y se vuelve -- sin este
  // estado "afuera", el usuario perdería su respuesta adivinada o el
  // rango de edad elegido apenas mira otra pestaña y vuelve.
  let tipoState = { revealed: false, guess: null, merged: false };

  // ------------------------------------------------------------
  // Animación de ENTRADA de "Casos por tipo" (pedido de Emi): el mismo
  // movimiento que el lazo de puntos del módulo 3 (ver entrada()/
  // armarLazo() en modulo3.js), pero con los elementos de ESTE gráfico:
  // los guiones del borde punteado de la barra de Mama arrancan sueltos
  // y vuelan, con el mismo resorte, hasta armar el contorno, como si se
  // dibujara (ver armarBarraConGuiones). Se hace UNA SOLA VEZ: la primera
  // vez que la pestaña se ve de verdad (intro cerrada y capítulo 1 en
  // pantalla). Ni al volver de otra pestaña, ni con "Probar de nuevo",
  // ni en ningún otro momento.
  //   tipoIntroHecha     -> ya se hizo (o no hace falta: "reducir
  //                         movimiento")
  //   tipoIntroPendiente -> la función que la arranca, guardada por
  //                         setupDrag() hasta que la pestaña sea visible
  let tipoIntroHecha = reduceMotion;
  let tipoIntroPendiente = null;
  const introEl = document.getElementById('intro');
  const chapterEl = root.closest('.chapter');
  function tipoVisible() {
    return (
      (!introEl || introEl.classList.contains('hidden')) &&
      (!chapterEl || chapterEl.classList.contains('active'))
    );
  }
  function revisarIntroTipo() {
    if (tipoIntroHecha || !tipoIntroPendiente || !tipoVisible()) return;
    const arrancar = tipoIntroPendiente;
    tipoIntroPendiente = null;
    tipoIntroHecha = true;
    arrancar();
  }

  // armarBarraConGuiones(host, barra, ocultar): arma la barra punteada
  // de Mama con SUS PROPIOS guiones (pedido de Emi: con los elementos de
  // este gráfico, no con los puntitos del módulo 3). Cada guión del borde
  // punteado sale desde la BASE de la barra y sube -- con el mismo
  // resorte que el lazo del módulo 3 (K=90, C=14) -- hasta su lugar en
  // el contorno, girando hasta quedar alineado con él. El contorno tiene
  // las mismas esquinas redondeadas que las barras (como las de "Casos
  // por edad") y se completa en el orden de un trazo: sube por la
  // izquierda, dobla, cruza arriba, dobla, baja por la derecha y cierra
  // abajo, como si el borde se dibujara. Mientras tanto, los elementos de "ocultar" (la zona de
  // arrastre con la barra real, el "?") quedan invisibles; al terminar,
  // los guiones dibujados se desvanecen justo cuando aparece la barra
  // real encima, con su relleno, su manija y el "?".
  function armarBarraConGuiones(host, barra, ocultar) {
    const hr = host.getBoundingClientRect();
    const br = barra.getBoundingClientRect();
    const W = hr.width;
    const H = hr.height;
    if (!W || !H || !br.width || !br.height) return;
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.className = 'em-intro-puntos';
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Guiones del contorno: mismo trazo que el borde de .em-guess-bar
    // (2px, rosa fuerte) y las MISMAS esquinas redondeadas que todas las
    // barras del módulo (7px arriba, 3px abajo -- como las de "Casos por
    // edad"). El contorno se recorre como un trazo: sube por la
    // izquierda, dobla la esquina, cruza arriba, dobla y baja por la
    // derecha, y cierra por abajo.
    const LARGO = 6; // largo de cada guión (px)
    const PASO = 10; // guión + espacio
    const RA = 7; // radio de las esquinas de arriba
    const RB = 3; // radio de las esquinas de abajo
    const x0 = br.left - hr.left + 1;
    const y0 = br.top - hr.top + 1;
    const x1 = br.right - hr.left - 1;
    const y1 = br.bottom - hr.top - 1;
    // Tramos del contorno, en el orden del trazo. Cada uno sabe su largo
    // y devuelve el punto y la dirección a una distancia "d" de su inicio.
    function recta(xa, ya, xb, yb) {
      const L = Math.hypot(xb - xa, yb - ya);
      const ang = Math.atan2(yb - ya, xb - xa);
      return {
        L: L,
        en: function (d) {
          return { x: xa + ((xb - xa) * d) / L, y: ya + ((yb - ya) * d) / L, ang: ang };
        },
      };
    }
    function arco(cx, cy, r, a0, a1) {
      return {
        L: Math.abs(a1 - a0) * r,
        en: function (d) {
          const a = a0 + (a1 - a0) * (d / (Math.abs(a1 - a0) * r));
          return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, ang: a + Math.PI / 2 };
        },
      };
    }
    const tramos = [
      recta(x0, y1 - RB, x0, y0 + RA), // izquierda, subiendo
      arco(x0 + RA, y0 + RA, RA, Math.PI, Math.PI * 1.5), // esquina arriba-izq.
      recta(x0 + RA, y0, x1 - RA, y0), // arriba
      arco(x1 - RA, y0 + RA, RA, Math.PI * 1.5, Math.PI * 2), // esquina arriba-der.
      recta(x1, y0 + RA, x1, y1 - RB), // derecha, bajando
      arco(x1 - RB, y1 - RB, RB, 0, Math.PI * 0.5), // esquina abajo-der.
      recta(x1 - RB, y1, x0 + RB, y1), // abajo
      arco(x0 + RB, y1 - RB, RB, Math.PI * 0.5, Math.PI), // esquina abajo-izq.
    ];
    const total = tramos.reduce(function (acc, t) {
      return acc + t.L;
    }, 0);
    const n = Math.max(8, Math.round(total / PASO));
    const guiones = [];
    for (let k = 0; k < n; k++) {
      let d = ((k + 0.5) * total) / n;
      let i = 0;
      while (i < tramos.length - 1 && d > tramos[i].L) {
        d -= tramos[i].L;
        i++;
      }
      const p = tramos[i].en(d);
      guiones.push({ tx: p.x, ty: p.y, tang: p.ang });
    }
    // Salida: los guiones aparecen desde la BASE de la barra (abajo,
    // repartidos un poco a los costados) y suben a su lugar en el orden
    // del trazo -- como si el contorno se dibujara de abajo hacia arriba.
    // Mismo escalonado que armarLazo() del módulo 3, un poco más largo.
    const cx = (x0 + x1) / 2;
    const anchoSalida = (x1 - x0) * 0.9;
    const t0 = performance.now();
    guiones.forEach(function (g, orden) {
      g.x = cx + (Math.random() - 0.5) * anchoSalida;
      g.y = y1 + 4 + Math.random() * 10;
      g.ang = Math.random() * Math.PI;
      g.vx = 0;
      g.vy = 0;
      g.va = 0;
      g.a = 0;
      g.at = t0 + (orden / guiones.length) * 650 + Math.random() * 80;
    });
    const DURACION = 1400; // tiempo hasta que la barra real toma el relevo (ms)
    const COL = '255,111,156'; // --rose-strong

    ocultar.forEach(function (el) {
      el.style.opacity = '0';
    });
    let ultimo = t0;
    let terminando = false;
    (function tick(t) {
      if (!canvas.isConnected) return; // se cambió de pestaña: se corta
      const dt = Math.min(0.033, (t - ultimo) / 1000 || 0.016);
      ultimo = t;
      const e = 1 - Math.exp(-dt * 7);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'butt';
      for (let i = 0; i < guiones.length; i++) {
        const g = guiones[i];
        const activo = t >= g.at;
        if (activo) {
          // resorte hacia su lugar y su ángulo en el contorno
          g.vx += ((g.tx - g.x) * 90 - g.vx * 14) * dt;
          g.vy += ((g.ty - g.y) * 90 - g.vy * 14) * dt;
          // el ángulo va por el camino más corto (un guión es igual girado 180°)
          let da = (g.tang - g.ang) % Math.PI;
          if (da > Math.PI / 2) da -= Math.PI;
          if (da < -Math.PI / 2) da += Math.PI;
          g.va += (da * 90 - g.va * 14) * dt;
        }
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.ang += g.va * dt;
        g.a += ((activo ? 1 : 0) - g.a) * e;
        const ux = (Math.cos(g.ang) * LARGO) / 2;
        const uy = (Math.sin(g.ang) * LARGO) / 2;
        ctx.beginPath();
        ctx.moveTo(g.x - ux, g.y - uy);
        ctx.lineTo(g.x + ux, g.y + uy);
        ctx.strokeStyle = 'rgba(' + COL + ',' + (g.a * 0.15).toFixed(3) + ')'; // resplandor suave
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(' + COL + ',' + g.a.toFixed(3) + ')'; // el guión
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (!terminando && t - t0 >= DURACION) {
        // El contorno ya está armado: la barra real toma el relevo SIN
        // corte (pedido de Emi: "siento que se corta"), en pasos que se
        // encadenan -- todo con animaciones CSS, ver "ENTRADA SIN CORTE"
        // en modulo1.css:
        //   1) los guiones dibujados se desvanecen MIENTRAS el borde real
        //      se enciende encima (nunca queda un momento sin barra);
        //   2) el relleno sube desde la base, como si la barra se llenara;
        //   3) la manija aparece con un rebote chico;
        //   4) el "?" aparece al final, también con un rebote suave.
        // Los elementos se muestran ya (opacity) porque cada uno arranca
        // invisible por su propia animación.
        terminando = true;
        canvas.classList.add('em-intro-fin');
        ocultar.forEach(function (el) {
          el.style.opacity = '';
          el.classList.add('em-intro-entrada');
        });
        setTimeout(function () {
          canvas.remove();
          ocultar.forEach(function (el) {
            el.classList.remove('em-intro-entrada');
          });
        }, 1200);
      }
      requestAnimationFrame(tick);
    })(t0);
  }
  // edadState: "Casos por edad" arranca con las 5 barras parejas, grises
  // y sin número (ver renderCasosPorEdad).
  //   sel      -> índice de la barra elegida (rosa), o null si todavía
  //               no se tocó ninguna
  //   revealed -> índices de las barras que ya se tocaron alguna vez
  //               (esas ya muestran su altura y número reales)
  let edadState = { sel: null, revealed: [] };

  // ============================================================
  // 6. RENDERIZADO DE GRÁFICOS
  // ============================================================

  // renderInlineStats(container, stats): la fila de "datos sueltos"
  // al pie de un gráfico (ej. "66,2 casos cada 100.000..."). "stats"
  // es un array de {valor, label}.
  function renderInlineStats(container, stats) {
    const wrap = document.createElement('div');
    wrap.className = 'em-inline-stats';
    stats.forEach(function (stat) {
      const item = document.createElement('div');
      item.className = 'em-stat';
      const value = document.createElement('span');
      value.className = 'em-stat-value';
      value.textContent = stat.valor;
      const label = document.createElement('span');
      label.className = 'em-stat-label';
      label.textContent = stat.label;
      item.appendChild(value);
      item.appendChild(label);
      wrap.appendChild(item);
    });
    container.appendChild(wrap);
    return wrap;
  }

  // fly(from, to, opts): anima "clones volando" de una posición a
  // otra -- la técnica atrás de la fusión/separación de columnas en
  // "Casos por tipo". Por cada posición en "from" crea un <div
  // class="em-fly">, lo anima (con el.animate(), Web Animations API)
  // hasta la posición de "to" que le toque (mismo índice), y lo saca
  // del DOM al terminar. "opts.stagger" es el retraso entre un clon y
  // el siguiente (efecto "en cadena" en vez de todos a la vez).
  // "opts.onLand(k)" se llama apenas ATERRIZA el clon k-ésimo (antes
  // de que terminen los demás) -- lo usa "Ver por separado" para que
  // la barra/etiqueta real de cada columna reaparezca apenas llega su
  // clon, no recién cuando terminan los 4. Los clones son SOLO el
  // rectángulo de color (sin texto adentro): antes llevaban el nombre
  // de la categoría puesto encima, pero ni la barra de origen ni la de
  // destino tienen texto ahí realmente (vive aparte, en .em-lbl) --
  // que apareciera/desapareciera de golpe con el clon se veía raro.
  function fly(chartEl, from, to, opts) {
    opts = opts || {};
    const duration = opts.duration != null ? opts.duration : 750;
    const stagger = opts.stagger != null ? opts.stagger : 110;
    const easing = opts.easing || 'cubic-bezier(.3,.7,.2,1)';
    const onLand = opts.onLand || function () {};
    return Promise.all(
      from.map(function (f, k) {
        const d = document.createElement('div');
        d.className = 'em-fly';
        Object.assign(d.style, f);
        chartEl.appendChild(d);
        const anim = d.animate([f, to[k]], {
          duration: reduceMotion ? 0 : duration,
          delay: reduceMotion ? 0 : k * stagger,
          easing: easing,
          fill: 'forwards',
        });
        return anim.finished.then(function () {
          onLand(k);
          d.remove();
        });
      }),
    );
  }

  // slide(el, dx): técnica FLIP (First-Last-Invert-Play) para que un
  // elemento que "saltó" de posición por un cambio de layout (ej.
  // Mama pasando de estar a la izquierda a quedar centrada) se vea
  // DESLIZARSE hasta ahí en vez de teletransportarse. Se llama JUSTO
  // DESPUÉS de aplicar el cambio de layout, con "dx" = la diferencia
  // entre la posición vieja y la nueva (ya recalculada) -- el
  // elemento arranca visualmente en la posición vieja (transform) y
  // anima hacia transform:none (la posición nueva, real).
  function slide(el, dx) {
    if (!dx || reduceMotion) return;
    el.animate([{ transform: 'translateX(' + dx + 'px)' }, { transform: 'translateX(0)' }], {
      duration: 800,
      easing: 'cubic-bezier(.3,.7,.2,1)',
    });
  }

  // rel(el, relativeTo): posición/tamaño de "el" en píxeles RELATIVOS
  // al contenedor "relativeTo" (no a la pantalla) -- lo que hace
  // falta para poder animar un clon que vive adentro de ese
  // contenedor con position:absolute.
  function rel(el, relativeTo) {
    const r = el.getBoundingClientRect();
    const c = relativeTo.getBoundingClientRect();
    return {
      left: r.left - c.left + 'px',
      top: r.top - c.top + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
    };
  }

  // ------------------------------------------------------------
  // "Casos por tipo de cáncer"
  // ------------------------------------------------------------
  // renderCasosPorTipo(container): arma el gráfico desde cero, en el
  // estado que corresponda según tipoState (recién llegando/a medio
  // adivinar, revelado, o revelado+fusionado). Las animaciones de
  // "revelar" y "fusionar/separar" NUNCA se repiten acá -- solo se
  // disparan una vez, desde el evento que las originó (soltar el
  // arrastre, o clickear el botón) -- así que reconstruir el gráfico
  // (ej. al volver de otra pestaña) siempre muestra el estado YA
  // decidido, de una, sin repetir nada.
  function renderCasosPorTipo(container) {
    const data = chapter1Data.casosPorTipo;
    const real = data[0].valor; // 20.750, el valor real de Mama
    const otherTotal = data.slice(1).reduce(function (s, d) {
      return s + d.valor;
    }, 0); // 20.216

    // "Fuente" puede estar viviendo adentro del pie de un render
    // anterior de esta misma pestaña (ver el final de esta función) --
    // se la devuelve a su lugar de siempre ANTES de vaciar el
    // contenedor, para no perderla con el innerHTML=''.
    if (emSrc.parentElement !== panel1.parentElement) {
      panel1.parentElement.appendChild(emSrc);
    }
    container.innerHTML = '';
    const top = document.createElement('div');
    top.className = 'em-tipo-top';

    const prompt = document.createElement('div');
    prompt.className =
      'em-prompt em-prompt-tipo em-reveal-fade' + (tipoState.revealed ? '' : ' em-shown');
    prompt.innerHTML =
      '<span class="em-prompt-dot" aria-hidden="true"></span>Arrastrá la barra para adivinar.'; // en 2 renglones (pedido de Emi): en uno solo quedaba muy larga
    top.appendChild(prompt);

    const feedback = document.createElement('div');
    feedback.className = 'em-feedback em-reveal-fade' + (tipoState.revealed ? ' em-shown' : '');
    top.appendChild(feedback);
    // setFeedback(html): escribe el mensaje de resultado envuelto en un
    // <span>, así .em-feedback (modulo1.css) puede bajarlo al fondo de su
    // caja como UN bloque de texto -- si el texto y los <b> fueran hijos
    // directos de un flex, cada pedazo quedaría en su propio renglón.
    function setFeedback(html, animar) {
      feedback.innerHTML = '<span>' + html + '</span>';
      const span = feedback.firstChild;
      if (animar && !reduceMotion) {
        span.style.display = 'inline-block';
        span.style.animationDelay = '0.9s';
        span.style.animationFillMode = 'backwards';
        span.classList.add('em-fade-in');
      }
    }
    container.appendChild(top);

    const chart = document.createElement('div');
    chart.className = 'em-chart-tipo';
    container.appendChild(chart);

    // tipoTipHTML(d): contenido del tooltip de una barra/segmento.
    function tipoTipHTML(d) {
      return (
        '<strong>' +
        d.categoria +
        '</strong>' +
        '<div><span>Casos</span><span>' +
        formatNumber(d.valor) +
        '</span></div>' +
        '<div><span>Por día</span><span>' +
        Math.round(d.valor / 365) +
        '</span></div>'
      );
    }

    const cols = data.map(function (d, i) {
      const isMama = i === 0;
      const showReal = tipoState.revealed;
      const pct = showReal ? (d.valor / TIPO_MAX) * 100 : 0;
      const col = document.createElement('div');
      col.className = 'em-col' + (!isMama && !showReal ? ' em-col-pending' : '');
      // em-val-q: SOLO mientras Mama muestra "?" (antes de arrastrar) --
      // agranda ese signo para que invite más a jugar. Se saca sola en
      // cuanto el usuario arrastra (ver setFromPx, más abajo), que
      // reemplaza el "?" por el número que va adivinando.
      const valHTML = isMama
        ? '<div class="em-val' +
          (showReal ? '' : ' em-val-q') +
          '">' +
          (showReal ? formatNumber(d.valor) : '?') +
          '</div>'
        : '<div class="em-val">' + (showReal ? formatNumber(d.valor) : '') + '</div>';
      const barStyle = 'height:' + pct + '%'; // 0% hasta revelar (Mama: la maneja setupDrag; las otras 4 están ocultas)
      // El nombre de Mama se ve siempre; el de las otras 4 solo aparece
      // junto con sus datos, al revelar. Mientras se adivina, la barra
      // de Mama dice "Cáncer de mama" (sola en el gráfico, el nombre
      // completo se entiende mejor); al revelar pasa a "Mama", como el
      // resto de las barras (pedido de Emi -- ver reveal()).
      const lblText = isMama
        ? showReal
          ? d.categoria
          : 'Cáncer de mama'
        : showReal
          ? d.categoria
          : '';
      // .em-plot: el área de dibujo de la barra (todo lo de la columna
      // MENOS la etiqueta). El % de alto de cada barra se calcula
      // contra ESTA caja, no contra la columna entera -- antes número +
      // barra + etiqueta compartían el mismo flex-column, y en pantallas
      // bajas (o con zoom/escalado de Windows, ej. la compu de Bren)
      // flexbox recortaba las barras altas hasta dejarlas todas del
      // mismo alto. El número (.em-val) va ADENTRO de la barra, con
      // position:absolute encima de su punta (ver modulo1.css), así no
      // le resta lugar a la barra y sube/baja pegado a ella.
      col.innerHTML =
        '<div class="em-plot">' +
        '<div class="em-bar' +
        (isMama ? ' em-bar-mama' : '') +
        '" style="' +
        barStyle +
        '">' +
        valHTML +
        '</div>' +
        '</div>' +
        '<div class="em-lbl">' +
        lblText +
        '</div>';
      const bar = col.querySelector('.em-bar');
      // El tooltip con el detalle (casos/día/tasa) solo tiene sentido
      // una vez que la columna ya muestra su dato real.
      bar.addEventListener('pointermove', function (e) {
        if (tipoState.revealed) showTip(e, tipoTipHTML(d));
      });
      bar.addEventListener('pointerleave', hideTip);
      chart.appendChild(col);
      return col;
    });
    const mama = cols[0];

    // Columna de la suma ("Los otros 4 cánceres"), oculta hasta que se
    // aprieta "¿Y si sumamos los otros 4?". La pila va de ABAJO hacia ARRIBA
    // en este orden: Colorrectal, Cuello uterino, Pulmón, Tiroides.
    const sumCol = document.createElement('div');
    sumCol.className = 'em-col';
    sumCol.id = 'em-sum-col';
    sumCol.hidden = true;
    // Misma estructura que las otras columnas (.em-plot + número
    // adentro de la pila, ver arriba). El número va AL FINAL de la pila
    // para que el primer hijo siga siendo el primer segmento; los
    // segmentos se buscan siempre por [data-i], así el número nunca se
    // confunde con un segmento.
    sumCol.innerHTML =
      '<div class="em-plot">' +
      '<div class="em-stack" style="height:' +
      (otherTotal / TIPO_MAX) * 100 +
      '%">' +
      [1, 2, 3, 4]
        .map(function (i) {
          return (
            '<div data-i="' +
            i +
            '" style="flex:' +
            data[i].valor +
            '">' +
            data[i].categoria +
            '</div>'
          );
        })
        .join('') +
      '<div class="em-val">' +
      formatNumber(otherTotal) +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="em-lbl">Los otros 4 cánceres</div>';
    sumCol.querySelectorAll('.em-stack > [data-i]').forEach(function (seg) {
      const d = data[+seg.dataset.i];
      seg.addEventListener('pointermove', function (e) {
        showTip(e, tipoTipHTML(d));
      });
      seg.addEventListener('pointerleave', hideTip);
    });
    mama.after(sumCol);

    // El eje "Los 5 cánceres más frecuentes" no se muestra al
    // principio -- recién tiene sentido una vez que hay algo que leer
    // ahí abajo, cuando se revela la comparación completa. Mismo
    // criterio "em-reveal-fade" que el prompt (ver ahí el comentario):
    // ocupa su lugar siempre, para que la tarjeta no cambie de alto.
    const axisNote = document.createElement('div');
    axisNote.className = 'em-axis-note em-reveal-fade' + (tipoState.revealed ? ' em-shown' : '');
    axisNote.textContent = 'Los 5 cánceres más frecuentes en mujeres'; // antes "Top 5 cánceres frecuentes"
    container.appendChild(axisNote);

    // Botones: "Probar de nuevo" primero, "¿Y si sumamos los otros 4?"
    // (antes "Ver los otros 4 juntos") segundo (orden pedido por Emi;
    // antes iba al revés), los 2
    // centrados (ver .em-tipo-actions en modulo1.css). Al "Probar de
    // nuevo" se le llama render1() en vez de renderCasosPorTipo(container)
    // directo, para que de paso corra el mismo paso que devuelve
    // "Fuente" a su lugar si hiciera falta (ver render1(), al final del
    // archivo) -- ahora que "Fuente" puede terminar movida adentro del
    // pie de esta pestaña, siempre hay que pasar por ahí antes de
    // volver a vaciar el contenedor.
    const actions = document.createElement('div');
    actions.className = 'em-tipo-actions em-reveal-fade' + (tipoState.revealed ? ' em-shown' : '');
    const btnReset = document.createElement('button');
    btnReset.type = 'button';
    // Mismo formato que el otro botón (pedido de Emi): antes "Probar de
    // nuevo" era más apagado (.em-btn-ghost, borde gris).
    btnReset.className = 'em-btn';
    btnReset.textContent = 'Probar de nuevo';
    const btnSum = document.createElement('button');
    btnSum.type = 'button';
    // em-btn-sum: ancho fijo (ver modulo1.css) -- su texto cambia de
    // largo ("¿Y si sumamos los otros 4?" / "Ver por separado") y, como el
    // grupo de botones está centrado, un botón que cambia de ancho
    // corría también a "Probar de nuevo" cada vez que se tocaba (pedido
    // de Emi: que se quede siempre en el mismo lugar).
    btnSum.className = 'em-btn em-btn-sum';
    btnSum.textContent = tipoState.merged ? 'Ver por separado' : SUM_LABEL;
    actions.appendChild(btnReset);
    actions.appendChild(btnSum);

    container.appendChild(actions);

    // Botón "Confirmar resultado": antes NO había confirmación -- soltar
    // la manija ya era la respuesta final, y un clic sin querer o un
    // cursor que se escapaba en pleno arrastre marcaban una respuesta
    // que la persona no eligió (pedido de Emi). Ahora arrastrar solo
    // ajusta el valor, y recién este botón revela el resultado.
    // Arranca OCULTO y aparece -- titilando, para invitar a tocarlo --
    // recién cuando la persona movió la barra por primera vez (ver
    // markMoved en setupDrag). Va al costado DERECHO de la barra de
    // Mama, a la altura de su base (pedido de Emi), no en la fila de abajo:
    // setupDrag() lo agrega adentro del área de la barra de Mama (.em-plot).
    const btnConfirm = document.createElement('button');
    btnConfirm.type = 'button';
    btnConfirm.className = 'em-btn em-btn-confirm em-reveal-fade';
    btnConfirm.textContent = 'Confirmar resultado';
    btnConfirm.disabled = true;

    // Fila con los 2 datos fijos que no dependen del juego ("1°"/"66,2"),
    // en un solo renglón (pedido de Emi) -- antes compartían esta fila
    // con .em-feedback (la respuesta variable), que ahora se movió
    // arriba, al lugar del prompt (ver "top", más arriba). Los datos
    // fijos TAMPOCO se ven al principio -- aparecen recién al revelar,
    // junto con todo lo demás (pedido de Emi: "aparecen cuando se
    // desliza la barra, al mismo tiempo que las barras se modifican"),
    // por eso llevan "em-reveal-fade".
    const resultRow = document.createElement('div');
    resultRow.className = 'em-tipo-result';

    const statsCol = document.createElement('div');
    statsCol.className =
      'em-tipo-result-stats em-reveal-fade' + (tipoState.revealed ? ' em-shown' : '');
    const statsLead = document.createElement('div');
    statsLead.className = 'em-stats-lead';
    statsLead.textContent = 'El cáncer de mama es:';
    statsCol.appendChild(statsLead);
    chapter1Stats.forEach(function (s) {
      const item = document.createElement('div');
      item.className = 'em-stat' + (s.clase ? ' ' + s.clase : '');
      item.innerHTML =
        '<div class="em-stat-value">' +
        s.valor +
        '</div>' +
        '<div class="em-stat-label">' +
        s.label +
        '</div>';
      statsCol.appendChild(item);
    });
    resultRow.appendChild(statsCol);
    container.appendChild(resultRow);

    // Pie de la tarjeta: la bajada que antes iba arriba de todo
    // ("Casos nuevos estimados...") + "Fuente", en la misma fila
    // (pedido de Emi). "Fuente" es el elemento COMPARTIDO de siempre
    // (.ui-src, ver index.html) -- se mueve para acá adentro; "Casos
    // por edad" usa esta misma fila (.em-foot, ver renderCasosPorEdad).
    const footRow = document.createElement('div');
    footRow.className = 'em-foot';
    const footSub = document.createElement('p');
    // "em-foot-sub-lg": el tamaño de esta bajada ahora tiene que
    // igualar al nuevo tamaño (agrandado) de los datos fijos -- ver
    // .em-tipo-result-stats .em-stat-label en modulo1.css (pedido de
    // Emi). Clase propia, solo para esta pestaña: "Casos por edad"
    // sigue con el tamaño de .ui-sub de siempre.
    footSub.className = 'ui-sub em-foot-sub-lg';
    footSub.textContent = 'Casos nuevos estimados en mujeres, por tipo de cáncer. Argentina, 2024.';
    footRow.appendChild(footSub);
    footRow.appendChild(emSrc);
    container.appendChild(footRow);

    // reveal(doAnimate): muestra la respuesta real de Mama. Se llama
    // con doAnimate=true SOLO desde el botón "Confirmar resultado"
    // (la ÚNICA vez que tiene sentido animar el crecimiento+conteo --
    // antes era al soltar la manija, ver setupDrag()); con false
    // al reconstruir un estado que YA estaba revelado (reafirma el
    // resultado final sin repetir la animación).
    function reveal(doAnimate) {
      tipoState.revealed = true;
      // classList.toggle (no .hidden): ver el comentario de "em-reveal-fade"
      // más arriba, en la creación de "prompt" -- estos elementos
      // quedan siempre ocupando su lugar, solo cambia su opacidad/
      // visibilidad, así la tarjeta no cambia de alto al revelar.
      // "prompt" y "feedback" comparten la misma celda (ver "top", más
      // arriba): uno se apaga justo cuando el otro se prende.
      prompt.classList.remove('em-shown');
      feedback.classList.add('em-shown');
      // Guía (pedido de Emi): apenas se revela el resultado, "¿Y si
      // sumamos los otros 4?" titila para invitar al paso siguiente; al
      // tocarlo deja de titilar (ver el click de btnSum, más abajo):
      // "Ver por separado" no titila y los 2 botones quedan iguales.
      if (doAnimate) {
        btnSum.classList.add('em-btn-blink');
        // Mientras titila, "Probar de nuevo" va con el borde apagado (gris)
        // para que se note bien cuál es el paso siguiente (pedido de Emi).
        btnReset.classList.add('em-btn-quiet');
      }
      actions.classList.add('em-shown');
      axisNote.classList.add('em-shown');
      statsCol.classList.add('em-shown');

      // Las otras 4 columnas (ocultas hasta ahora, ver "em-col-pending"
      // al crear las columnas) aparecen con su altura y datos reales.
      // Mama estaba sola, centrada: al aparecer las otras 4, el layout
      // la manda a su lugar (la primera, a la izquierda) -- slide()
      // hace que se vea DESLIZARSE hasta ahí en vez de saltar (misma
      // técnica FLIP que ya usa "¿Y si sumamos los otros 4?").
      const others = cols.slice(1);
      mama.querySelector('.em-lbl').textContent = data[0].categoria; // "Cáncer de mama" -> "Mama"
      const mamaX0 = mama.getBoundingClientRect().left;
      data.slice(1).forEach(function (d, idx) {
        const col = others[idx];
        col.querySelector('.em-val').textContent = formatNumber(d.valor);
        col.querySelector('.em-lbl').textContent = d.categoria;
        col.classList.remove('em-col-pending');
      });
      if (doAnimate) slide(mama, mamaX0 - mama.getBoundingClientRect().left);

      // Cada columna aparece UNA POR UNA, de izquierda a derecha (pedido
      // de Emi): un fundido + desliz corto de la columna entera (número
      // y nombre incluidos) y su barra creciendo desde 0, cada una un
      // poco después de la anterior. Sin animación (reconstruir un
      // estado ya revelado, o "reducir movimiento"), quedan directo en
      // su alto real.
      others.forEach(function (col, idx) {
        const b = col.querySelector('.em-bar');
        const pctOther = (data[idx + 1].valor / TIPO_MAX) * 100;
        if (!doAnimate || reduceMotion) {
          b.style.height = pctOther + '%';
          return;
        }
        const delay = 350 + idx * 140;
        col.animate(
          [
            { opacity: 0, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 450, delay: delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
        );
        b.style.height = '0%';
        setTimeout(function () {
          b.style.height = pctOther + '%'; // el crecimiento lo anima .em-bar (transition:height, modulo1.css)
        }, delay);
      });

      const plot = mama.querySelector('.em-plot');
      const bar = mama.querySelector('.em-bar');
      const valEl = mama.querySelector('.em-val');
      // Deja de seguir a la manija (ver placeQ/placeVal en setupDrag):
      // vuelve a la punta de la barra real, con su tamaño de siempre.
      valEl.style.bottom = '';
      valEl.style.fontSize = '';
      valEl.style.marginBottom = '';
      valEl.classList.remove('em-val-live');
      const guess = tipoState.guess;
      const pct = (real / TIPO_MAX) * 100;

      // Línea punteada "Tu respuesta" (si ya había una de un render
      // anterior, se saca). Va adentro de .em-plot, en % -- la MISMA
      // escala que usa la barra (real/TIPO_MAX % de .em-plot), así que
      // queda siempre en proporción a ella, aunque después cambie el
      // alto de la pantalla o el zoom. Antes se calculaba UNA sola vez
      // en px (midiendo la barra al revelar): si después se hacía zoom,
      // la barra se achicaba pero la línea se quedaba donde estaba, y
      // podía terminar ARRIBA de la barra aunque la respuesta fuera
      // menor que el valor real (reportado con la compu de Bren).
      const oldLine = mama.querySelector('.em-guess-line');
      if (oldLine) oldLine.remove();
      const line = document.createElement('div');
      line.className = 'em-guess-line';
      // Si la respuesta quedó cerca del valor real, la línea pasa justo
      // por donde está el número ("20.750") -- en ese caso el texto
      // "Tu respuesta" va DEBAJO de la línea en vez de arriba, para no
      // taparlo.
      if (Math.abs(guess - real) / real < 0.15) line.classList.add('em-guess-line-below');
      line.style.bottom = (guess / TIPO_MAX) * 100 + '%';
      line.innerHTML = '<span>Tu respuesta</span>';
      plot.appendChild(line);

      if (doAnimate && !reduceMotion) {
        // Arranca en 0 sin transición y recién ahí crece animada.
        bar.style.transition = 'none';
        bar.style.height = '0%';
        void bar.offsetWidth; // fuerza un reflow: sin esto, el navegador podría saltearse el 0% y no animar nada
        requestAnimationFrame(function () {
          bar.style.transition = 'height .9s cubic-bezier(.2,.8,.2,1)';
          bar.style.height = pct + '%';
        });
        countUp(valEl, real);
      } else {
        bar.style.height = pct + '%';
        valEl.textContent = formatNumber(real);
      }

      // Mensaje de resultado: tono intermedio (pedido de Emi) -- ni de
      // juego ("¡Adivinaste!", "lo que pensabas") ni de informe técnico,
      // y corto. "Se estiman" en vez de "son": 20.750 es una estimación
      // de GLOBOCAN, no un conteo exacto. La diferencia va en % de la
      // estimación de la persona (o "más del doble/triple" si se quedó
      // muy corta).
      const ratio = real / guess;
      const dijiste = 'Dijiste <b>' + formatNumber(guess) + '</b>. ';
      const seEstiman = 'Se estiman <b>' + formatNumber(real) + '</b>';
      let msg;
      if (guess === real) {
        msg = 'Acertaste: se estiman <b>' + formatNumber(real) + '</b> casos por año.';
      } else if (Math.abs(ratio - 1) < 0.1) {
        msg =
          'Estuviste cerca: dijiste <b>' +
          formatNumber(guess) +
          '</b> y se estiman <b>' +
          formatNumber(real) +
          '</b>.';
      } else if (ratio >= 3) {
        msg = dijiste + seEstiman + ': más del triple.';
      } else if (ratio >= 2) {
        msg = dijiste + seEstiman + ': más del doble.';
      } else if (ratio > 1) {
        msg = dijiste + seEstiman + ': un ' + Math.round((ratio - 1) * 100) + '% más.';
      } else {
        msg = dijiste + seEstiman + ': un ' + Math.round((1 - ratio) * 100) + '% menos.';
      }
      // Ya no agrega "Eso es N diagnósticos por día" al final (pedido
      // de Emi: sacarlo de la respuesta variable).
      setFeedback(msg, doAnimate);
    }

    // setupDrag(): arma la zona de arrastre sobre la columna de Mama
    // (toda su .em-plot, o sea desde la etiqueta hacia arriba) + la
    // barra punteada + la manija "↕". Pointer Events
    // (pointerdown/move/up) cubren mouse Y touch con el mismo código,
    // sin ramas separadas para celular. La zona mide lo mismo que
    // .em-plot, así que la respuesta (px / alto de la zona) usa la
    // misma escala que la barra real.
    function setupDrag() {
      const valEl = mama.querySelector('.em-val');
      const zone = document.createElement('div');
      zone.className = 'em-guess-zone';
      // La manija dice "↕ Arrastrá" (antes solo "↕"): sola, la flecha no
      // alcanzaba para que se entendiera que había que moverla (pedido
      // de Emi). tabindex/role="slider": también se puede mover con el
      // teclado (ver keydown, más abajo).
      zone.innerHTML =
        '<div class="em-guess-bar">' +
        '<div class="em-handle" tabindex="0" role="slider" aria-label="Estimación de casos de cáncer de mama por año"' +
        ' aria-valuemin="0" aria-valuemax="' +
        TIPO_MAX +
        '">↕ Arrastrá</div>' +
        '</div>';
      mama.querySelector('.em-plot').appendChild(zone);
      // Al costado derecho de la barra de Mama, alineado con su BASE
      // (pedido de Emi): va adentro de .em-plot -- el área de la barra,
      // sin la etiqueta "Mama" -- así "bottom:0" (ver .em-btn-confirm en
      // modulo1.css) cae justo sobre la línea donde arranca la barra.
      mama.querySelector('.em-plot').appendChild(btnConfirm);
      const gb = zone.querySelector('.em-guess-bar');
      const handle = zone.querySelector('.em-handle');

      // placeQ(px): ANTES de arrastrar, el "?" va ADENTRO de la barra
      // punteada, centrado en el lugar que deja libre la manija, con un
      // tamaño de letra calculado para que entre en la barra de ESTA
      // pantalla (como mucho los 2.1rem de siempre, ~34px). Antes
      // quedaba fijo al pie de la columna y, en pantallas bajas o con
      // zoom, la manija caía justo encima y lo tapaba (en las compus de
      // las chicas no se veía).
      //   7 = cuánto se mete la manija DENTRO de la barra punteada
      //       (top:-13px + height:20px en .em-handle, modulo1.css)
      //   2 = el borde punteado de la barra (2px arriba y abajo)
      function placeQ(px) {
        const free = px - 7 - 2 * 2; // alto libre adentro de la barra, debajo de la manija
        const fs = Math.max(10, Math.min(34, free * 0.8, (gb.clientWidth - 4) * 0.6));
        valEl.style.fontSize = fs + 'px';
        valEl.style.marginBottom = '0';
        valEl.style.bottom = 2 + (free - fs) / 2 + 'px';
      }
      // placeVal(px): DESPUÉS de empezar a arrastrar, el número que se va
      // adivinando flota ENCIMA de la manija "↕", siguiéndola (adentro
      // de la barra no siempre entra: con una respuesta chica la barra
      // punteada mide muy poco). 13 = cuánto sobresale la manija por
      // arriba de la barra punteada. El tope (maxBottom) evita que,
      // arrastrando hasta arriba de todo, el número se salga del
      // gráfico y pise el prompt rosa.
      // El número va siempre ARRIBA de la manija, en cualquier valor
      // (también en 25.000). Si cerca del máximo no entra completo, se
      // achica lo justo (ver más abajo) -- antes se frenaba en el borde
      // del gráfico y la manija ("↕ Arrastrá", ahora más ancha) lo
      // tapaba (reportado por Emi).
      function placeVal(px) {
        valEl.style.fontSize = '';
        valEl.style.marginBottom = '';
        const valH = valEl.offsetHeight;
        // Techo para el número: puede subir por encima del gráfico, al
        // espacio libre que hay entre el gráfico y la instrucción rosa
        // (antes se frenaba en el borde del gráfico, y entre 24.000 y
        // 24.950 eso lo dejaba encima de la manija). 4px de aire con la
        // instrucción. Se mide en vivo porque ese espacio cambia con el
        // alto de pantalla (--ui-gap-titulo, style.css).
        const roomTop = prompt.getBoundingClientRect().bottom + 4;
        const maxBottom = zone.getBoundingClientRect().bottom - roomTop - valH - 6; // 6 = margin-bottom de .em-val
        // Cerca del máximo (ej. 24.000-25.000), en pantallas bajas como
        // la de Bren, ni subiendo hasta la instrucción entra el número
        // completo arriba de la manija: en ese caso se achica lo justo
        // (nunca por debajo de 14px) para que no se pisen, en vez de
        // quitarle alto al gráfico para hacerle lugar. Siempre va
        // ARRIBA de la manija, también en 25.000 (pedido de Emi).
        const short = px + 13 - maxBottom;
        if (short > 0) {
          const fs = parseFloat(getComputedStyle(valEl).fontSize);
          const fit = Math.max(14, (fs * (valH - short)) / valH);
          valEl.style.fontSize = fit + 'px';
          valEl.style.bottom = Math.max(0, px + 13) + 'px';
          return;
        }
        valEl.style.bottom = Math.max(0, px + 13) + 'px';
      }
      // setFromPx(px): redondea a múltiplos de 50 (antes 100) -- con
      // 50 SÍ se puede caer justo en 20.750, el valor real de Mama
      let curPx = 0; // alto actual de la barra punteada (lo usa el arrastre relativo, ver pointerdown)
      function setFromPx(px) {
        px = Math.max(6, Math.min(zone.clientHeight, px));
        curPx = px;
        gb.style.height = px + 'px';
        tipoState.guess = Math.max(50, Math.round(((px / zone.clientHeight) * TIPO_MAX) / 50) * 50);
        valEl.classList.remove('em-val-q'); // ya hay un número real adivinado: el "?" grande deja de aplicar
        // em-val-live: el número que se va eligiendo se ve más grande que
        // los de las barras -- con Mama sola en el gráfico, ese número es
        // la única referencia de cuánto se está estimando.
        valEl.classList.add('em-val-live');
        valEl.textContent = formatNumber(tipoState.guess);
        handle.setAttribute('aria-valuenow', tipoState.guess);
        handle.setAttribute('aria-valuetext', formatNumber(tipoState.guess) + ' casos');
        placeVal(px);
      }
      // showQ(): estado inicial (todavía no arrastró). La barra punteada
      // arranca en el 42% del gráfico, pero nunca menos de 60px (si no,
      // en una pantalla baja el "?" quedaría diminuto) ni más del 80%.
      function showQ() {
        const h = zone.clientHeight;
        // Arranca en el 42% del gráfico (antes 30%: Emi la pidió un poco
        // más alta), nunca menos de 60px ni más del 80%.
        const startPx = Math.min(h * 0.8, Math.max(h * 0.42, 60));
        setFromPx(startPx);
        valEl.classList.remove('em-val-live');
        valEl.classList.add('em-val-q'); // vuelve a mostrarse "?" -- re-agrega la clase que setFromPx sacó
        valEl.textContent = '?'; // el valor arranca oculto -- recién se ve al mover el dedo/mouse
        handle.setAttribute('aria-valuetext', 'Sin estimación todavía');
        placeQ(startPx);
      }
      requestAnimationFrame(function () {
        showQ();
        // La PRIMERA vez que se ve la pestaña, la barra punteada se arma
        // con sus propios guiones (armarBarraConGuiones, más arriba). Si
        // todavía no se
        // ve (intro abierta, otro capítulo), queda pendiente hasta que se
        // vea -- ver revisarIntroTipo().
        if (!tipoIntroHecha) {
          tipoIntroPendiente = function () {
            armarBarraConGuiones(chart, gb, [zone, valEl]);
          };
          revisarIntroTipo();
        }
      });
      // Si cambia el alto del gráfico ANTES de arrastrar (zoom, ventana
      // más chica/grande), se vuelve a acomodar la barra punteada y el
      // "?" para el tamaño nuevo. Se desconecta apenas se empieza a
      // arrastrar: desde ahí manda la posición elegida por el usuario.
      let ro = null;
      if (window.ResizeObserver) {
        ro = new ResizeObserver(function () {
          if (valEl.classList.contains('em-val-q')) showQ();
        });
        ro.observe(zone);
      }

      // Solo la MANIJA (.em-handle) inicia el arrastre -- tocar en
      // cualquier otro lugar de la zona/barra no hace nada (pedido de
      // Emi, de antes).
      //
      // CAMBIO (pedido de Emi): antes SOLTAR la manija ya era la
      // respuesta final, y además el pointerdown movía la barra hasta
      // donde se hacía clic. Resultado: un clic sin querer, o un cursor
      // que se escapaba en pleno arrastre, marcaban una respuesta que la
      // persona no había elegido. Ahora:
      //   - el arrastre es RELATIVO: la barra se mueve lo mismo que se
      //     mueve el mouse/dedo desde donde se agarró la manija, así que
      //     agarrarla no la hace saltar;
      //   - un clic sin mover (menos de 3px) no cambia nada;
      //   - soltar NO revela: la barra queda donde quedó y se puede
      //     seguir corrigiendo cuantas veces se quiera;
      //   - el resultado se ve recién con el botón "Confirmar
      //     resultado", que aparece después del primer movimiento.
      let dragging = false;
      let moved = false;
      let startY = 0;
      let startPx = 0;

      // markMoved(): la primera vez que la persona mueve la barra (con
      // mouse, dedo o teclado) -- se activa "Confirmar resultado", la
      // manija deja de "llamar la atención" (ver .em-handle-used en
      // modulo1.css) y el ResizeObserver de más arriba se desconecta:
      // desde acá manda la posición que eligió la persona.
      function markMoved() {
        if (moved) return;
        moved = true;
        btnConfirm.disabled = false;
        btnConfirm.classList.add('em-shown'); // aparece (titilando, ver modulo1.css) recién ahora
        handle.classList.add('em-handle-used');
        // La barra punteada deja de brillar (pedido de Emi): desde acá
        // -- arrastrando o quieta antes de confirmar -- lo único que
        // titila es "Confirmar resultado", que es lo que hay que tocar.
        zone.classList.add('em-guess-quiet');
        if (ro) ro.disconnect();
      }

      handle.addEventListener('pointerdown', function (e) {
        dragging = true;
        startY = e.clientY;
        startPx = curPx;
        // setPointerCapture: asegura que sigamos recibiendo
        // pointermove/pointerup aunque el mouse/dedo se salga de la
        // manija en pleno arrastre rápido. try/catch porque algunos
        // navegadores lo rechazan en ciertos casos (puntero ya no
        // activo) -- si falla, el arrastre igual funciona mientras el
        // cursor se quede sobre la manija, así que no vale la pena
        // cortar el resto del gesto por esto.
        try {
          handle.setPointerCapture(e.pointerId);
        } catch (err) {}
        e.preventDefault();
        e.stopPropagation();
      });
      handle.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        const dy = startY - e.clientY; // hacia arriba = positivo
        if (!moved && Math.abs(dy) < 3) return; // un temblor del clic no cuenta como mover
        markMoved();
        setFromPx(startPx + dy);
      });
      function endDrag() {
        dragging = false;
      }
      handle.addEventListener('pointerup', endDrag);
      handle.addEventListener('pointercancel', endDrag);
      handle.addEventListener('lostpointercapture', endDrag);

      // Teclado (accesibilidad): con la manija enfocada (Tab), las
      // flechas suben/bajan la estimación de a 250 casos, Re Pág/Av Pág
      // de a 1.000, Inicio/Fin van al mínimo/máximo, y Enter confirma.
      handle.addEventListener('keydown', function (e) {
        const steps = {
          ArrowUp: 250,
          ArrowRight: 250,
          ArrowDown: -250,
          ArrowLeft: -250,
          PageUp: 1000,
          PageDown: -1000,
        };
        let target = null;
        if (e.key in steps) target = tipoState.guess + steps[e.key];
        else if (e.key === 'Home') target = 0;
        else if (e.key === 'End') target = TIPO_MAX;
        else if (e.key === 'Enter') {
          if (moved) btnConfirm.click();
          e.preventDefault();
          return;
        } else return;
        markMoved();
        target = Math.max(0, Math.min(TIPO_MAX, target));
        setFromPx((target / TIPO_MAX) * zone.clientHeight);
        e.preventDefault();
      });

      btnConfirm.addEventListener('click', function () {
        if (!moved) return;
        dragging = false;
        if (ro) ro.disconnect();
        zone.remove();
        btnConfirm.remove();
        reveal(true);
      });
    }

    // applyMergeState(doAnimate): hace que el DOM coincida con
    // tipoState.merged (el valor YA actualizado por quien llama). Si
    // doAnimate es true, vuela los clones; si no, salta directo al
    // estado final (se usa al reconstruir una tarjeta que ya estaba
    // fusionada, ej. al volver de otra pestaña).
    async function applyMergeState(doAnimate) {
      btnSum.disabled = true;
      hideTip();
      const others = [1, 2, 3, 4].map(function (i) {
        return cols[i];
      });
      const stackEl = sumCol.querySelector('.em-stack');
      const sumValEl = sumCol.querySelector('.em-val');

      // La línea "Tu respuesta" (si todavía está, de cuando se reveló)
      // se borra apenas se toca cualquiera de los dos botones -- fusionar
      // o separar. Ya no vuelve a aparecer sola: solo la trae de vuelta
      // un arrastre nuevo (ver reveal(), que la recrea desde cero cada
      // vez). Antes se quedaba pegada a Mama y se deslizaba con ella al
      // centrarse, lo cual no tenía sentido una vez que ya se está
      // comparando contra "los otros 4 juntos".
      const guessLine = mama.querySelector('.em-guess-line');
      if (guessLine) guessLine.remove();

      if (tipoState.merged) {
        const x0 = mama.getBoundingClientRect().left;
        chart.style.setProperty('--em-colw', mama.getBoundingClientRect().width + 'px');

        // BUG real que causaba el "desaparece y reaparece mágicamente":
        // "src" (de dónde vuela cada clon) se tiene que medir ANTES de
        // ocultar las columnas -- una columna con hidden=true mide
        // 0x0 (display:none), así que los 4 clones arrancaban todos en
        // un punto minúsculo cerca de la esquina del gráfico, en vez de
        // la posición real de cada barra. Con eso, no había ninguna
        // transición visible: las columnas se apagaban de golpe y, recién
        // al final, aparecía la pila ya armada. Midiendo acá, con las 4
        // columnas todavía visibles en su lugar de siempre, cada clon
        // arranca exactamente donde está su barra real.
        const src =
          doAnimate && !reduceMotion
            ? others.map(function (c) {
                return rel(c.querySelector('.em-bar'), chart);
              })
            : null;

        chart.classList.add('em-merged');
        others.forEach(function (c) {
          c.hidden = true;
        });
        sumCol.hidden = false;
        slide(mama, x0 - mama.getBoundingClientRect().left);

        if (doAnimate && !reduceMotion) {
          // Los clones (.em-fly) vuelan SIN el texto de la etiqueta --
          // antes lo llevaban adentro (ver "labels" más abajo en la
          // versión vieja), pero la barra de origen no tiene ningún
          // texto puesto encima (el nombre vive aparte, en .em-lbl,
          // debajo) -- que apareciera de golpe dentro del clon quedaba
          // raro. Ahora el clon es solo el rectángulo de color viajando.
          const segs = Array.prototype.slice.call(stackEl.querySelectorAll('[data-i]'));
          const tgt = segs.map(function (seg) {
            return rel(seg, chart);
          });
          segs.forEach(function (s) {
            s.style.visibility = 'hidden';
          });
          sumValEl.style.visibility = 'hidden';
          await fly(chart, src, tgt, {
            onLand: function (k) {
              segs[k].style.visibility = '';
            },
          });
          sumValEl.style.visibility = '';
          countUp(sumValEl, otherTotal);
        } else {
          sumValEl.textContent = formatNumber(otherTotal);
        }
        setFeedback(
          // El total de los otros 4 va en blanco (.em-fb-neutral) y solo
          // el de mama en rosa
          'Los otros 4 cánceres suman <b class="em-fb-neutral">' +
            formatNumber(otherTotal) +
            '</b> casos: menos que los <b>' +
            formatNumber(real) +
            '</b> de mama.',
        );
        btnSum.textContent = 'Ver por separado';
      } else {
        const x0 = mama.getBoundingClientRect().left;
        if (doAnimate && !reduceMotion) {
          const segs = Array.prototype.slice.call(stackEl.querySelectorAll('[data-i]'));
          const src = segs.map(function (seg) {
            return rel(seg, chart);
          });
          sumValEl.style.visibility = 'hidden';
          chart.classList.remove('em-merged');
          sumCol.hidden = true;
          others.forEach(function (c) {
            c.hidden = false;
            c.classList.add('em-ghost');
          });
          slide(mama, x0 - mama.getBoundingClientRect().left);
          const bars = others.map(function (c) {
            return c.querySelector('.em-bar');
          });
          bars.forEach(function (b) {
            b.style.visibility = 'hidden';
          });
          const srcRev = src.slice().reverse();
          const tgtRev = bars
            .map(function (b) {
              return rel(b, chart);
            })
            .reverse();
          await fly(chart, srcRev, tgtRev, {
            duration: 650,
            stagger: 90,
            easing: 'cubic-bezier(.45,.05,.25,1)',
            onLand: function (k) {
              const realIdx = others.length - 1 - k; // deshace el reverse
              bars[realIdx].style.visibility = '';
              others[realIdx].classList.remove('em-ghost');
            },
          });
        } else {
          chart.classList.remove('em-merged');
          sumCol.hidden = true;
          others.forEach(function (c) {
            c.hidden = false;
            c.classList.remove('em-ghost');
          });
          slide(mama, x0 - mama.getBoundingClientRect().left);
        }
        setFeedback('Tocá <b>' + SUM_LABEL + '</b> para compararlos con Mama.');
        btnSum.textContent = SUM_LABEL;
      }
      btnSum.disabled = false;
    }

    btnSum.addEventListener('click', function () {
      if (btnSum.disabled) return;
      // Tocar "¿Y si sumamos los otros 4?" cierra la guía: el botón deja
      // de titilar (ver reveal()) -- "Ver por separado" ya NO titila
      // (pedido de Emi).
      btnSum.classList.remove('em-btn-blink');
      btnReset.classList.remove('em-btn-quiet'); // desde acá los 2 botones con el borde rosa
      tipoState.merged = !tipoState.merged;
      applyMergeState(true);
    });
    btnReset.addEventListener('click', function () {
      tipoState = { revealed: false, guess: null, merged: false };
      render1();
      animarEntrada(); // misma entrada que al cambiar de pestaña (antes la daba animateIn)
    });

    // ---- reconstruye el estado actual (si lo había) ----
    if (tipoState.revealed) reveal(false);
    else setupDrag();
    if (tipoState.merged) applyMergeState(false);
  }

  // ------------------------------------------------------------
  // "Casos por edad"
  // ------------------------------------------------------------
  function renderCasosPorEdad(container) {
    const data = chapter1Data.casosPorEdad;
    const total = data.reduce(function (s, d) {
      return s + d.valor;
    }, 0); // 20.750

    // "Fuente" puede estar viviendo adentro del pie de un render
    // anterior de esta misma pestaña (ver el final de esta función) --
    // se la devuelve a su lugar de siempre ANTES de vaciar el
    // contenedor, para no perderla con el innerHTML='' (mismo criterio
    // que renderCasosPorTipo).
    if (emSrc.parentElement !== panel1.parentElement) {
      panel1.parentElement.appendChild(emSrc);
    }
    container.innerHTML = '';
    const prompt = document.createElement('div');
    prompt.className = 'em-prompt em-prompt-tipo';
    prompt.innerHTML =
      '<span class="em-prompt-dot" aria-hidden="true"></span>Tocá una barra para ver la cantidad en un rango de edad.';
    container.appendChild(prompt);

    const chart = document.createElement('div');
    chart.className = 'em-chart-edad';
    container.appendChild(chart);

    // edadTipHTML(d): contenido del tooltip de una barra de edad.
    function edadTipHTML(d) {
      return (
        '<strong>' +
        d.categoria +
        ' años</strong>' +
        '<div><span>Casos</span><span>' +
        formatNumber(d.valor) +
        '</span></div>' +
        '<div><span>Del total</span><span>' +
        pctLabel(d.valor / total) +
        '%</span></div>'
      );
    }

    const EDAD_START = 3000;
    const isRevealed = function (i) {
      return edadState.revealed.indexOf(i) !== -1;
    };

    const cols = data.map(function (d, i) {
      const col = document.createElement('div');
      col.className = 'em-col em-col-age';
      // Misma estructura que "Casos por tipo" (.em-plot + número adentro
      // de la barra): así el % de cada barra es proporcional de verdad.
      // El número ya está escrito desde el principio, pero oculto
      // (.em-bar-pending, ver modulo1.css) hasta que se toca la barra.
      const shown = isRevealed(i);
      col.innerHTML =
        '<div class="em-plot">' +
        '<div class="em-bar' +
        (shown ? '' : ' em-bar-pending') +
        '" style="height:' +
        ((shown ? d.valor : EDAD_START) / EDAD_MAX) * 100 +
        '%">' +
        '<div class="em-val">' +
        formatNumber(d.valor) +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="em-lbl">' +
        d.categoria +
        '</div>';
      col.addEventListener('pointerdown', function (e) {
        setSel(i);
        e.preventDefault();
      });
      const bar = col.querySelector('.em-bar');
      // El globo con el detalle, solo en barras ya tocadas: en las
      // grises adelantaría el dato antes de tocarlas.
      bar.addEventListener('pointermove', function (e) {
        if (isRevealed(i)) showTip(e, edadTipHTML(d));
      });
      bar.addEventListener('pointerleave', hideTip);
      chart.appendChild(col);
      return col;
    });

    // Los 2 datos sueltos: se arman UNA vez con renderInlineStats (el
    // texto real lo pone paint(), de abajo) y después se actualizan
    // reescribiendo el texto directo -- no hace falta destruir y
    // reconstruir el DOM en cada clic.
    const statsWrap = renderInlineStats(container, [
      { valor: '', label: '' },
      { valor: '', label: '' },
    ]);
    const stats = statsWrap.querySelectorAll('.em-stat');
    const selPctEl = stats[0].querySelector('.em-stat-value');
    const selTxtEl = stats[0].querySelector('.em-stat-label');
    const selDiaEl = stats[1].querySelector('.em-stat-value');
    const selDiaTxtEl = stats[1].querySelector('.em-stat-label');

    const footRow = document.createElement('div');
    footRow.className = 'em-foot';
    const footSub = document.createElement('p');
    footSub.className = 'ui-sub';
    footSub.textContent = 'Casos nuevos estimados en mujeres, por edad. Argentina, 2024.';
    footRow.appendChild(footSub);
    footRow.appendChild(emSrc);
    container.appendChild(footRow);

    function setSel(i) {
      if (!isRevealed(i)) {
        edadState.revealed.push(i);
        const bar = cols[i].querySelector('.em-bar');
        bar.classList.remove('em-bar-pending');
        bar.style.height = (data[i].valor / EDAD_MAX) * 100 + '%';
      }
      edadState.sel = i;
      paint();
    }

    // fillStats(d): escribe los 2 datos de abajo para la edad "d".
    function fillStats(d) {
      const share = d.valor / total;
      // Última barra ("75 o más", sin "hasta"): "a partir de los X
      // años"; el resto: "entre los X y Y años".
      const rango =
        d.hasta == null
          ? 'a partir de los ' + d.desde + ' años'
          : 'entre los ' + d.desde + ' y ' + d.hasta + ' años';
      // Siempre "X de cada 100"
      selPctEl.textContent = Math.round(share * 100) + ' de cada 100';
      selTxtEl.textContent = 'casos ocurren ' + rango + '.';
      selDiaEl.textContent = String(Math.round(d.valor / 365));
      selDiaTxtEl.textContent = 'diagnósticos por día ' + rango + '.';
    }

    // paint(): pinta de rosa la barra elegida y actualiza los datos de abajo. Si no hay ninguna barra elegida (sel=null), deja todas grises y los datos en blanco.
    function paint() {
      const sel = edadState.sel;
      cols.forEach(function (col, i) {
        col.querySelector('.em-bar').classList.toggle('em-bar-sel', i === sel);
      });
      statsWrap.classList.toggle('em-stats-empty', sel === null);
      fillStats(data[sel === null ? 3 : sel]);
    }

    paint(); // estado inicial (o el que haya quedado de un render anterior)
  }
  // FUENTES: lo que muestra "Fuente" en cada pestaña (lo arma uiFuente,
  // en script.js).
  const FUENTES = {
    casosPorTipo: [
      {
        autor: 'GLOBOCAN (2026)',
        etiqueta: 'Casos por tipo de cáncer',
        url: 'https://gco.iarc.who.int/media/globocan/factsheets/populations/32-argentina-fact-sheet.pdf',
      },
    ],
    casosPorEdad: [
      {
        autor: 'GLOBOCAN (2026)',
        etiqueta: 'Casos por edad',
        url: 'https://gco.iarc.who.int/today/en/dataviz/pie?mode=cancer&cancers=20&types=0&sexes=2&populations=32&age_start=3&age_end=5&group_populations=1&multiple_populations=0',
      },
    ],
  };

  const TITULOS = {
    casosPorTipo: '¿Cuántos casos de cáncer de mama hay por año?',
    casosPorEdad: '¿Cuántos casos de cáncer de mama hay por edad?',
  };
  const cardTitle = panel1.parentElement.querySelector('.ui-card-title');

  const chartRenderers = {
    casosPorTipo: function (container) {
      renderCasosPorTipo(container);
    },
    casosPorEdad: function (container) {
      renderCasosPorEdad(container);
    },
  };

  // ============================================================
  // 8. ARRANQUE
  // ============================================================
  const tabs1 = root.querySelectorAll('.em-tab');
  let activeKey =
    (root.querySelector('.em-tab.active') && root.querySelector('.em-tab.active').dataset.chart) ||
    'casosPorTipo';

  function render1() {
    // "Fuente" (emSrc) puede haber quedado movida adentro del pie de un render anterior de esta misma pestaña (ver el final de cada
    if (emSrc.parentElement !== panel1.parentElement) {
      panel1.parentElement.appendChild(emSrc);
    }
    if (cardTitle && TITULOS[activeKey]) cardTitle.textContent = TITULOS[activeKey];
    if (FUENTES[activeKey]) uiFuente(emSrc, FUENTES[activeKey]);
    const renderFn = chartRenderers[activeKey];
    if (renderFn) renderFn(panel1);
  }

  function animarEntrada() {
    if (reduceMotion) return;
    panel1.classList.remove('em-fade-in');
    void panel1.offsetWidth;
    panel1.classList.add('em-fade-in');
  }

  tabs1.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs1.forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      // La fuente desaparece y recién ahí se cambia el gráfico
      uiFuenteSalir(emSrc, function () {
        activeKey = tab.dataset.chart;
        if (activeKey === 'casosPorTipo') {
          tipoState = { revealed: false, guess: null, merged: false };
        } else if (activeKey === 'casosPorEdad') {
          edadState = { sel: null, revealed: [] }; // arranca de cero: 5 barras parejas sin tocar
        }
        render1();
        animarEntrada();
      });
    });
  });

  render1(); // primer dibujo, apenas carga la página

  // La animación de entrada de "Casos por tipo" espera a que la pestaña
  // se vea de verdad: se revisa cada vez que cambia la clase de la intro
  // (se cierra con .hidden) o del capítulo 1 (se activa con .active).
  if (window.MutationObserver) {
    const mo = new MutationObserver(revisarIntroTipo);
    if (introEl) mo.observe(introEl, { attributes: true, attributeFilter: ['class'] });
    if (chapterEl) mo.observe(chapterEl, { attributes: true, attributeFilter: ['class'] });
  }
})();
