// ============================================================
// MODULO1.JS — Capítulo 1 "Argentina hoy" — Emi — prefijo: em-
// ============================================================
// QUÉ HACE ESTE ARCHIVO: dibuja los 3 gráficos de la tarjeta del
// Capítulo 1 y maneja las 3 pestañas que eligen cuál se ve:
//   - "Casos por tipo de cáncer": INTERACTIVO. El usuario arrastra
//     una barra para ADIVINAR cuánto cree que vale "Mama" antes de
//     ver el valor real (que crece animado + cuenta desde 0), y
//     después puede comparar "Mama" contra la suma de los otros 4
//     cánceres (animación de fusión/separación de columnas).
//   - "Casos por edad": INTERACTIVO. El usuario elige un rango de
//     edad (clic o arrastre sobre las barras, o 3 chips de acceso
//     rápido) y los 2 datos de abajo se recalculan en vivo.
//   - "Porcentaje": el waffle de 100 cuadrados (sin cambios).
//
// CÓMO ESTÁ ORGANIZADO (de arriba a abajo):
//   1. Guarda de entrada (si el HTML del módulo no está, no hace nada)
//   2. Paleta/tipografía + "reduceMotion" (leído de prefers-reduced-motion)
//   3. Herramientas genéricas (formatNumber, pctLabel, countUp, animateIn)
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
// Animations API (el.animate()) que con coordenadas SVG -- es además
// el mismo enfoque que ya usaba el waffle de "Porcentaje" en este
// mismo archivo. También se sacó el breakpoint que pasaba "Casos por
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

  // ============================================================
  // 2. PALETA, TIPOGRAFÍA Y "REDUCIR MOVIMIENTO"
  // ============================================================
  const rootStyle = getComputedStyle(document.documentElement);
  // cssVar('--rose-strong') -> "#ff6f9c" (leído de :root, para no
  // repetir colores sueltos -- si algún día cambia en style.css, acá
  // se actualiza solo).
  const cssVar = (name) => rootStyle.getPropertyValue(name).trim();

  const THEME = {
    colors: {
      roseStrong: cssVar('--rose-strong'),
      text: cssVar('--text'),
      textDim: cssVar('--text-dim'),
    },
  };

  // reduceMotion: preferencia de accesibilidad del sistema operativo
  // ("reducir movimiento"). Se lee UNA sola vez acá (antes el waffle
  // la leía por su cuenta, ahora la comparten los 3 gráficos) y se
  // usa para saltear tanto las animaciones CSS (ver modulo1.css, el
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
    if (reduceMotion) { el.textContent = formatNumber(to); return; }
    const t0 = performance.now();
    (function tick(t) {
      const p = Math.min(1, (t - t0) / 600);
      el.textContent = formatNumber(Math.round(to * p));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  // animateIn(el, delay): fundido + desliz hacia arriba de 8px, para
  // que una tarjeta recién dibujada no aparezca de golpe.
  function animateIn(el, delay) {
    if (reduceMotion) return;
    delay = delay || 0;
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'opacity .6s ease, transform .6s ease';
    requestAnimationFrame(function () {
      setTimeout(function () {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, delay);
    });
  }

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
    // que siempre quede adentro.
    const x = Math.min(e.clientX + 14, window.innerWidth - 200);
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

  // chapter1Stats: los 2 datos sueltos que acompañan al gráfico
  // "Casos por tipo de cáncer" (no cambian con la interacción).
  const chapter1Stats = [
    { valor: '1°', label: 'Cáncer más frecuente en mujeres' },
    { valor: '66,2', label: 'casos cada 100.000 mujeres' },
  ];

  // TIPO_MAX / EDAD_MAX: techo del eje (en casos) que usa cada
  // gráfico de barras para calcular la altura -- antes era
  // "opts.maxValue" al llamar a renderBarChart; ahora, sin esa
  // función, quedan como constantes nombradas.
  const TIPO_MAX = 25000;
  const EDAD_MAX = 8000;

  const chapter1Data = {
    // Top 5 cánceres más frecuentes en mujeres en Argentina, 2024.
    // "tasa" = tasa ajustada por edad (ASR, cada 100.000 mujeres) de
    // CADA tipo -- antes solo existía el de Mama (66,2, en
    // chapter1Stats); se agrega acá el resto porque el tooltip nuevo
    // de cada barra la necesita (mismos valores de referencia que el
    // prototipo).
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
    // Distribución de TODOS los cánceres en mujeres, AR 2024 (69.449
    // casos en total), para el waffle de 100 cuadrados.
    porcentaje: [
      { key: 'mama', categoria: 'Mama', porcentaje: 29.9, sq: 30, casos: 20750, headline: '3 de cada 10', text: 'son de mama' },
      { key: 'crc', categoria: 'Colorrectal', porcentaje: 11.1, sq: 11, casos: 7698, text: 'son colorrectales' },
      { key: 'cu', categoria: 'Cuello uterino', porcentaje: 6.7, sq: 7, casos: 4679, text: 'son de cuello uterino' },
      { key: 'pul', categoria: 'Pulmón', porcentaje: 6.4, sq: 6, casos: 4469, text: 'son de pulmón' },
      { key: 'tir', categoria: 'Tiroides', porcentaje: 4.9, sq: 5, casos: 3370, text: 'son de tiroides' },
      { key: 'otr', categoria: 'Otros', porcentaje: 41.0, sq: 41, casos: 28483, text: 'corresponden a otros tipos de cáncer' },
    ],
  };

  // tipoState / edadState: el estado de cada gráfico interactivo,
  // declarado FUERA de las funciones de render (así sobrevive a un
  // redibujado). Hace falta porque el panel se vuelve a dibujar de
  // cero cada vez que se cambia de pestaña y se vuelve -- sin este
  // estado "afuera", el usuario perdería su respuesta adivinada o el
  // rango de edad elegido apenas mira otra pestaña y vuelve.
  let tipoState = { revealed: false, guess: null, merged: false };
  let edadState = { sel: [2, 3] }; // índices en casosPorEdad: "45-59".."60-74" (45 a 74 años)

  // edadDragEnd: a qué función avisarle cuando se suelta el mouse/dedo
  // durante un arrastre en "Casos por edad". Se declara acá (no
  // adentro de renderCasosPorEdad) porque el listener de
  // "pointerup" se registra UNA sola vez en <document> (ver el
  // arranque, al final) -- si se registrara adentro de la función de
  // render, cada redibujado apilaría un listener nuevo sin sacar el
  // anterior.
  let edadDragEnd = function () {};

  // ============================================================
  // 6. RENDERIZADO DE GRÁFICOS
  // ============================================================

  // renderSubtitle(container, subtitle): el párrafo de bajada
  // ("Casos nuevos estimados en mujeres...") arriba de cada gráfico,
  // con la clase compartida .ui-sub (mismo tamaño que el módulo 3).
  function renderSubtitle(container, subtitle) {
    if (!subtitle) return;
    const el = document.createElement('p');
    el.className = 'ui-sub';
    el.textContent = subtitle;
    container.appendChild(el);
  }

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
    return Promise.all(from.map(function (f, k) {
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
    }));
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
    el.animate(
      [{ transform: 'translateX(' + dx + 'px)' }, { transform: 'translateX(0)' }],
      { duration: 800, easing: 'cubic-bezier(.3,.7,.2,1)' }
    );
  }

  // rel(el, relativeTo): posición/tamaño de "el" en píxeles RELATIVOS
  // al contenedor "relativeTo" (no a la pantalla) -- lo que hace
  // falta para poder animar un clon que vive adentro de ese
  // contenedor con position:absolute.
  function rel(el, relativeTo) {
    const r = el.getBoundingClientRect();
    const c = relativeTo.getBoundingClientRect();
    return { left: (r.left - c.left) + 'px', top: (r.top - c.top) + 'px', width: r.width + 'px', height: r.height + 'px' };
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
    const otherTotal = data.slice(1).reduce(function (s, d) { return s + d.valor; }, 0); // 20.216

    container.innerHTML = '';
    renderSubtitle(container, 'Casos nuevos estimados en mujeres, por tipo de cáncer. Argentina, 2024.');

    // Invitación a jugar, con el punto rosa que pulsa -- se oculta en
    // cuanto se revela la respuesta (y se queda oculta para siempre,
    // salvo que se aprete "Volver a adivinar"). "em-prompt-tipo" (además
    // de la "em-prompt" compartida con "Casos por edad") es lo que deja
    // agrandar/centrar el texto SOLO acá, sin afectar el prompt de edad.
    const prompt = document.createElement('div');
    prompt.className = 'em-prompt em-prompt-tipo';
    prompt.innerHTML = '<span class="em-prompt-dot" aria-hidden="true"></span>Arrastrá la barra rosa y soltala para ver el dato.';
    prompt.hidden = tipoState.revealed;
    container.appendChild(prompt);

    const chart = document.createElement('div');
    chart.className = 'em-chart-tipo';
    container.appendChild(chart);

    // tipoTipHTML(d): contenido del tooltip de una barra/segmento.
    function tipoTipHTML(d) {
      return '<strong>' + d.categoria + '</strong>' +
        '<div><span>Casos</span><span>' + formatNumber(d.valor) + '</span></div>' +
        '<div><span>Por día</span><span>' + Math.round(d.valor / 365) + '</span></div>' +
        '<div><span>Tasa ajustada</span><span>' + d.tasa.toLocaleString('es-AR') + '</span></div>';
    }

    // Las 5 columnas (Mama primero). La de Mama arranca en 0/"?" si
    // todavía no se reveló; si ya se reveló (reconstruyendo estado),
    // arranca directo mostrando el valor real.
    const cols = data.map(function (d, i) {
      const isMama = i === 0;
      const showReal = !isMama || tipoState.revealed;
      const pct = (showReal ? d.valor : 0) / TIPO_MAX * 100;
      const col = document.createElement('div');
      col.className = 'em-col';
      // em-val-q: SOLO mientras se muestra "?" (antes de arrastrar) --
      // agranda ese signo para que invite más a jugar. Se saca sola en
      // cuanto el usuario arrastra (ver setFromPx, más abajo), que
      // reemplaza el "?" por el número que va adivinando.
      col.innerHTML =
        '<div class="em-val' + (showReal ? '' : ' em-val-q') + '">' + (showReal ? formatNumber(d.valor) : '?') + '</div>' +
        '<div class="em-bar' + (isMama ? ' em-bar-mama' : '') + '" style="height:' + pct + '%"></div>' +
        '<div class="em-lbl">' + d.categoria + '</div>';
      const bar = col.querySelector('.em-bar');
      bar.addEventListener('pointermove', function (e) {
        if (!isMama || tipoState.revealed) showTip(e, tipoTipHTML(d));
      });
      bar.addEventListener('pointerleave', hideTip);
      chart.appendChild(col);
      return col;
    });
    const mama = cols[0];

    // Columna de la suma ("Los otros 4 cánceres"), oculta hasta que se
    // aprieta "Ver los otros 4 juntos". La pila va de ABAJO hacia ARRIBA
    // en este orden: Colorrectal, Cuello uterino, Pulmón, Tiroides.
    const sumCol = document.createElement('div');
    sumCol.className = 'em-col';
    sumCol.id = 'em-sum-col';
    sumCol.hidden = true;
    sumCol.innerHTML =
      '<div class="em-val">' + formatNumber(otherTotal) + '</div>' +
      '<div class="em-stack" style="height:' + (otherTotal / TIPO_MAX * 100) + '%">' +
      [1, 2, 3, 4].map(function (i) {
        return '<div data-i="' + i + '" style="flex:' + data[i].valor + '">' + data[i].categoria + '</div>';
      }).join('') +
      '</div>' +
      '<div class="em-lbl">Los otros 4 cánceres</div>';
    sumCol.querySelectorAll('.em-stack > div').forEach(function (seg) {
      const d = data[+seg.dataset.i];
      seg.addEventListener('pointermove', function (e) { showTip(e, tipoTipHTML(d)); });
      seg.addEventListener('pointerleave', hideTip);
    });
    mama.after(sumCol);

    const axisNote = document.createElement('div');
    axisNote.className = 'em-axis-note';
    axisNote.textContent = 'Los 5 cánceres más frecuentes en mujeres'; // antes "Top 5 cánceres frecuentes"
    container.appendChild(axisNote);

    const feedback = document.createElement('div');
    feedback.className = 'em-feedback';
    container.appendChild(feedback);

    // Textos de los botones: "Ver los otros 4 juntos" (antes "Sumá los
    // otros 4") y "Probar de nuevo" (antes "Volver a adivinar") -- el
    // texto que aparece al separar (más abajo, dentro de
    // applyMergeState) y el de la frase de abajo ("Tocá...") se
    // actualizaron junto con este para que todos digan lo mismo.
    const actions = document.createElement('div');
    actions.className = 'em-tipo-actions';
    actions.hidden = !tipoState.revealed;
    const btnSum = document.createElement('button');
    btnSum.type = 'button';
    btnSum.className = 'em-btn';
    btnSum.textContent = tipoState.merged ? 'Ver por separado' : 'Ver los otros 4 juntos';
    const btnReset = document.createElement('button');
    btnReset.type = 'button';
    btnReset.className = 'em-btn em-btn-ghost';
    btnReset.textContent = 'Probar de nuevo';
    actions.appendChild(btnSum);
    actions.appendChild(btnReset);
    container.appendChild(actions);

    // Clase extra (además de la que ya pone renderInlineStats) para
    // poder empujar ESTOS datos más abajo sin tocar los de "Casos por
    // edad" -- ver .em-inline-stats-tipo en modulo1.css.
    renderInlineStats(container, chapter1Stats).classList.add('em-inline-stats-tipo');

    // reveal(doAnimate): muestra la respuesta real de Mama. Se llama
    // con doAnimate=true SOLO desde el soltar del arrastre (la ÚNICA
    // vez que tiene sentido animar el crecimiento+conteo); con false
    // al reconstruir un estado que YA estaba revelado (reafirma el
    // resultado final sin repetir la animación).
    function reveal(doAnimate) {
      tipoState.revealed = true;
      prompt.hidden = true;
      actions.hidden = false;

      const bar = mama.querySelector('.em-bar');
      const valEl = mama.querySelector('.em-val');
      const lblH = mama.querySelector('.em-lbl').offsetHeight;
      const guess = tipoState.guess;
      const pct = (real / TIPO_MAX) * 100;

      // Dónde ubicar la línea "Tu respuesta": NO alcanza con calcular
      // "guess/TIPO_MAX" a mano y asumirlo como % del alto de la
      // columna -- .em-bar comparte ese flex-column con .em-val y
      // .em-lbl, así que flexbox la encoge un poco para que los 3
      // entren (su alto real termina siendo MENOS que un % puro del
      // alto de la columna, y cuánto menos no es algo fácil de
      // predecir a mano). Antes esto hacía que, con una adivinanza
      // bastante más alta que el valor real, la línea terminara muy
      // arriba de donde debía -- pisando el número ("20.750").
      // Solución: en vez de recalcular la proporción, le preguntamos
      // al navegador cuánto mide la barra YA puesta en su alto real
      // (sin transición, por un instante) y ubicamos la línea en
      // proporción a ESA medida real -- así, cuando la adivinanza es
      // igual al valor real, la línea cae exactamente sobre la punta
      // de la barra, siempre.
      bar.style.transition = 'none';
      bar.style.height = pct + '%';
      const finalBarH = bar.getBoundingClientRect().height;
      const barBottomOffset = lblH + 10; // 10 = margin-top de .em-lbl (ver modulo1.css)
      const guessPx = finalBarH * (guess / real);

      // Línea punteada "Tu respuesta" (si ya había una de un render
      // anterior, se saca).
      const oldLine = mama.querySelector('.em-guess-line');
      if (oldLine) oldLine.remove();
      const line = document.createElement('div');
      line.className = 'em-guess-line';
      line.style.bottom = (barBottomOffset + guessPx) + 'px';
      line.innerHTML = '<span>Tu respuesta</span>';
      mama.appendChild(line);

      if (doAnimate && !reduceMotion) {
        // La medición de arriba ya dejó la barra en su alto final,
        // sin transición -- la volvemos a 0 y recién ahí la animamos,
        // para que el crecimiento se siga viendo igual que antes.
        bar.style.height = '0%';
        void bar.offsetWidth; // fuerza un reflow: sin esto, el navegador podría saltearse el 0% y no animar nada
        requestAnimationFrame(function () {
          bar.style.transition = 'height .9s cubic-bezier(.2,.8,.2,1)';
          bar.style.height = pct + '%';
        });
        countUp(valEl, real);
      } else {
        valEl.textContent = formatNumber(real);
      }

      const ratio = real / guess;
      let msg;
      if (Math.abs(ratio - 1) < 0.1) {
        msg = 'Dijiste <b>' + formatNumber(guess) + '</b>. ¡Muy cerca! Son <b>' + formatNumber(real) + '</b> casos por año.';
      } else if (ratio > 1) {
        const cuanto = ratio >= 2.9 ? 'más del triple' : ratio >= 1.9 ? 'más del doble' : 'bastantes más';
        msg = 'Dijiste <b>' + formatNumber(guess) + '</b>. Son <b>' + formatNumber(real) + '</b>: ' + cuanto + ' de lo que pensabas.';
      } else {
        msg = 'Dijiste <b>' + formatNumber(guess) + '</b>. Son <b>' + formatNumber(real) + '</b>, menos de lo que pensabas, pero casi el triple que el segundo.';
      }
      feedback.innerHTML = msg + ' Eso es <b>' + Math.round(real / 365) + ' diagnósticos por día</b>.';
    }

    // setupDrag(): arma la zona de arrastre sobre la columna de Mama
    // (desde la etiqueta hacia arriba) + la barra punteada + la
    // manija "↕". Pointer Events (pointerdown/move/up) cubren mouse Y
    // touch con el mismo código, sin ramas separadas para celular.
    function setupDrag() {
      const valEl = mama.querySelector('.em-val');
      const lblH = mama.querySelector('.em-lbl').offsetHeight;
      const zone = document.createElement('div');
      zone.className = 'em-guess-zone';
      zone.style.bottom = (lblH + 10) + 'px';
      zone.innerHTML = '<div class="em-guess-bar"><div class="em-handle">↕</div></div>';
      mama.appendChild(zone);
      const gb = zone.querySelector('.em-guess-bar');

      function setFromPx(px) {
        px = Math.max(6, Math.min(zone.clientHeight, px));
        gb.style.height = px + 'px';
        tipoState.guess = Math.max(100, Math.round((px / zone.clientHeight) * TIPO_MAX / 100) * 100);
        valEl.classList.remove('em-val-q'); // ya hay un número real adivinado: el "?" grande deja de aplicar
        valEl.textContent = formatNumber(tipoState.guess);
      }
      requestAnimationFrame(function () {
        setFromPx(zone.clientHeight * 0.3);
        valEl.classList.add('em-val-q'); // vuelve a mostrarse "?" (todavía no arrastró) -- re-agrega la clase que setFromPx sacó
        valEl.textContent = '?'; // el valor arranca oculto -- recién se ve al mover el dedo/mouse
      });

      let dragging = false;
      zone.addEventListener('pointerdown', function (e) {
        dragging = true;
        // setPointerCapture: asegura que sigamos recibiendo
        // pointermove/pointerup aunque el mouse/dedo se salga del
        // área de "zone" en pleno arrastre rápido. try/catch porque
        // algunos navegadores lo rechazan en ciertos casos (puntero
        // ya no activo) -- si falla, el arrastre igual funciona
        // mientras el cursor se quede adentro de la zona, así que no
        // vale la pena cortar el resto del gesto por esto.
        try { zone.setPointerCapture(e.pointerId); } catch (err) {}
        setFromPx(zone.getBoundingClientRect().bottom - e.clientY);
      });
      zone.addEventListener('pointermove', function (e) {
        if (dragging) setFromPx(zone.getBoundingClientRect().bottom - e.clientY);
      });
      zone.addEventListener('pointerup', function () {
        if (!dragging) return;
        dragging = false;
        zone.remove();
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
      const others = [1, 2, 3, 4].map(function (i) { return cols[i]; });
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
        const src = (doAnimate && !reduceMotion)
          ? others.map(function (c) { return rel(c.querySelector('.em-bar'), chart); })
          : null;

        chart.classList.add('em-merged');
        others.forEach(function (c) { c.hidden = true; });
        sumCol.hidden = false;
        slide(mama, x0 - mama.getBoundingClientRect().left);

        if (doAnimate && !reduceMotion) {
          // Los clones (.em-fly) vuelan SIN el texto de la etiqueta --
          // antes lo llevaban adentro (ver "labels" más abajo en la
          // versión vieja), pero la barra de origen no tiene ningún
          // texto puesto encima (el nombre vive aparte, en .em-lbl,
          // debajo) -- que apareciera de golpe dentro del clon quedaba
          // raro. Ahora el clon es solo el rectángulo de color viajando.
          const segs = Array.prototype.slice.call(stackEl.querySelectorAll('div'));
          const tgt = segs.map(function (seg) { return rel(seg, chart); });
          // Cada clon se saca del DOM apenas TERMINA SU PROPIO vuelo (ver
          // fly()) -- como tienen demoras escalonadas (stagger), terminan
          // en momentos distintos. Antes se ocultaba la pila ENTERA
          // (stackEl) y se mostraba recién cuando terminaban los 4: el
          // primer clon en aterrizar (Colorrectal) ya se había sacado,
          // pero su segmento real todavía seguía oculto esperando a los
          // otros 3 -- quedaba un hueco vacío ahí durante ese tramo ("se
          // ve que desaparece"). Ahora cada segmento se oculta/muestra
          // por separado, en su propio onLand -- apenas aterriza SU clon,
          // aparece SU segmento, sin esperar a los demás (mismo criterio
          // que ya usa "Ver por separado" con sus barras reales). El
          // total ("20.216") sigue esperando a que terminen los 4, tiene
          // sentido que cuente recién cuando la pila está completa.
          segs.forEach(function (s) { s.style.visibility = 'hidden'; });
          sumValEl.style.visibility = 'hidden';
          await fly(chart, src, tgt, {
            onLand: function (k) { segs[k].style.visibility = ''; },
          });
          sumValEl.style.visibility = '';
          countUp(sumValEl, otherTotal);
        } else {
          sumValEl.textContent = formatNumber(otherTotal);
        }
        feedback.innerHTML = 'Colorrectal + cuello uterino + pulmón + tiroides = <b>' + formatNumber(otherTotal) + '</b>. Mama sola (<b>' + formatNumber(real) + '</b>) supera a los cuatro juntos.';
        btnSum.textContent = 'Ver por separado';
      } else {
        const x0 = mama.getBoundingClientRect().left;
        if (doAnimate && !reduceMotion) {
          const segs = Array.prototype.slice.call(stackEl.querySelectorAll('div'));
          const src = segs.map(function (seg) { return rel(seg, chart); });
          sumValEl.style.visibility = 'hidden';
          chart.classList.remove('em-merged');
          sumCol.hidden = true;
          others.forEach(function (c) { c.hidden = false; c.classList.add('em-ghost'); });
          slide(mama, x0 - mama.getBoundingClientRect().left);
          const bars = others.map(function (c) { return c.querySelector('.em-bar'); });
          bars.forEach(function (b) { b.style.visibility = 'hidden'; });
          // Vuelan en orden INVERSO (Tiroides -- el de más arriba en
          // la pila -- primero), como pide la consigna. duration/
          // stagger más cortos que antes (eran 1100/140, hasta 1,5s
          // en total): cada barra real queda INVISIBLE (ver
          // bars.forEach más arriba) hasta que aterriza su propio
          // clon -- con la secuencia tan larga, se sentía como que
          // "se rompía" (una barra desaparecida un buen rato antes de
          // reaparecer), más que una animación prolija.
          // Tampoco llevan el nombre adentro (mismo motivo que al
          // fusionar, ver arriba): antes el texto "bajaba" pegado al
          // clon desde la pila hasta la barra y después desaparecía de
          // golpe al sacarse el clon, hasta que .em-lbl (el nombre de
          // verdad, abajo de la barra) reaparecía por separado -- se
          // veía como si el nombre cayera, se borrara y volviera a
          // aparecer. Ahora el clon vuela vacío (solo el color) y
          // .em-lbl/.em-val hacen su propio fade-in al aterrizar
          // (onLand saca .em-ghost), un solo movimiento limpio.
          const srcRev = src.slice().reverse();
          const tgtRev = bars.map(function (b) { return rel(b, chart); }).reverse();
          await fly(chart, srcRev, tgtRev, {
            duration: 650, stagger: 90, easing: 'cubic-bezier(.45,.05,.25,1)',
            onLand: function (k) {
              const realIdx = others.length - 1 - k; // deshace el reverse
              bars[realIdx].style.visibility = '';
              others[realIdx].classList.remove('em-ghost');
            },
          });
        } else {
          chart.classList.remove('em-merged');
          sumCol.hidden = true;
          others.forEach(function (c) { c.hidden = false; c.classList.remove('em-ghost'); });
          slide(mama, x0 - mama.getBoundingClientRect().left);
        }
        feedback.innerHTML = 'Tocá <b>Ver los otros 4 juntos</b> para compararlos con Mama.';
        btnSum.textContent = 'Ver los otros 4 juntos';
      }
      btnSum.disabled = false;
    }

    btnSum.addEventListener('click', function () {
      if (btnSum.disabled) return;
      tipoState.merged = !tipoState.merged;
      applyMergeState(true);
    });
    btnReset.addEventListener('click', function () {
      tipoState = { revealed: false, guess: null, merged: false };
      renderCasosPorTipo(container);
    });

    // ---- reconstruye el estado actual (si lo había) ----
    if (tipoState.revealed) reveal(false);
    else setupDrag();
    if (tipoState.merged) applyMergeState(false);

    animateIn(container);
  }

  // ------------------------------------------------------------
  // "Casos por edad"
  // ------------------------------------------------------------
    function renderCasosPorEdad(container) {
    const data = chapter1Data.casosPorEdad;
    const total = data.reduce(function (s, d) { return s + d.valor; }, 0); // 20.750

    container.innerHTML = '';
    renderSubtitle(container, 'Casos nuevos estimados en mujeres, por edad. Argentina, 2024.');

    const prompt = document.createElement('div');
    prompt.className = 'em-prompt em-prompt-tipo';
    prompt.innerHTML = '<span class="em-prompt-dot" aria-hidden="true"></span>Tocá o arrastrá sobre las barras para elegir un rango de edad.';
    container.appendChild(prompt);

    // Chips de acceso rápido. "r" = [índice desde, índice hasta] en "data".
    const chipDefs = [
      { label: 'Menos de 45', r: [0, 1] },
      { label: '45 a 74 años', r: [2, 3] },
      { label: '75 o más', r: [4, 4] },
      { label: 'Todas las edades', r: [0, 4] },
    ];
    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'em-chips';
    const chipEls = chipDefs.map(function (c) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'em-chip';
      btn.textContent = c.label;
      btn.dataset.r = c.r.join(',');
      btn.addEventListener('click', function () { setSel(c.r[0], c.r[1]); });
      chipsWrap.appendChild(btn);
      return btn;
    });
    container.appendChild(chipsWrap);

    const chart = document.createElement('div');
    chart.className = 'em-chart-edad';
    container.appendChild(chart);

    // edadTipHTML(d): contenido del tooltip de una barra de edad.
    function edadTipHTML(d) {
      return '<strong>' + d.categoria + ' años</strong>' +
        '<div><span>Casos</span><span>' + formatNumber(d.valor) + '</span></div>' +
        '<div><span>Del total</span><span>' + pctLabel(d.valor / total) + '%</span></div>' +
        '<div><span>Por día</span><span>' + (d.valor / 365).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '</span></div>';
    }

    let dragging = false, anchor = null;
    const cols = data.map(function (d, i) {
      const col = document.createElement('div');
      col.className = 'em-col em-col-age';
      col.innerHTML =
        '<div class="em-val">' + formatNumber(d.valor) + '</div>' +
        '<div class="em-bar" style="height:' + (d.valor / EDAD_MAX * 100) + '%"></div>' +
        '<div class="em-lbl">' + d.categoria + '</div>';
      col.addEventListener('pointerdown', function (e) {
        dragging = true;
        anchor = i;
        setSel(i, i);
        e.preventDefault();
      });
      col.addEventListener('pointerenter', function () { if (dragging) setSel(anchor, i); });
      const bar = col.querySelector('.em-bar');
      bar.addEventListener('pointermove', function (e) { showTip(e, edadTipHTML(d)); });
      bar.addEventListener('pointerleave', hideTip);
      chart.appendChild(col);
      return col;
    });

    // El arrastre TÁCTIL no dispara "pointerenter" al pasar de una
    // columna a otra (solo mouse) -- hace falta mirar a mano qué
    // columna hay debajo del dedo con elementFromPoint.
    chart.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerType === 'mouse') return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const col = el && el.closest('.em-col-age');
      if (col) setSel(anchor, cols.indexOf(col));
    });
    // El "soltar" se escucha UNA sola vez en <document> (ver el
    // arranque) -- acá solo se actualiza a qué función avisarle.
    edadDragEnd = function () { dragging = false; };

    const axisNote = document.createElement('div');
    axisNote.className = 'em-axis-note';
    axisNote.textContent = 'Años';
    container.appendChild(axisNote);

    // Los 2 datos sueltos: se arman UNA vez con renderInlineStats (el
    // texto real lo pone paint(), de abajo) y después se actualizan
    // reescribiendo el texto directo -- no hace falta destruir y
    // reconstruir el DOM en cada clic/arrastre.
    const statsWrap = renderInlineStats(container, [{ valor: '', label: '' }, { valor: '', label: '' }]);
    const stats = statsWrap.querySelectorAll('.em-stat');
    const selPctEl = stats[0].querySelector('.em-stat-value');
    const selTxtEl = stats[0].querySelector('.em-stat-label');
    const selDiaEl = stats[1].querySelector('.em-stat-value');
    const selDiaTxtEl = stats[1].querySelector('.em-stat-label');

    const note = document.createElement('p');
    note.className = 'em-note';
    note.textContent = 'Son cantidades de casos, no riesgo: hay menos casos después de los 75 años porque hay menos mujeres de esa edad';
    container.appendChild(note);

    // setSel(a, b): fija el rango elegido como [menor, mayor] (no
    // importa en qué orden se arrastró -- de atrás para adelante o al
    // revés da el mismo rango) y repinta.
    function setSel(a, b) {
      edadState.sel = [Math.min(a, b), Math.max(a, b)];
      paint();
    }

    // paint(): pinta las barras del rango elegido, marca el chip que
    // coincida (si alguno), recalcula el "X de cada 10" / casos / por
    // día, y arma la frase -- todo calculado desde "data".
    function paint() {
      const sel = edadState.sel;
      cols.forEach(function (col, i) {
      col.querySelector('.em-bar').classList.toggle('em-bar-sel', i >= sel[0] && i <= sel[1]);
      });
      chipEls.forEach(function (chip) {
        chip.setAttribute('aria-pressed', chip.dataset.r === sel.join(','));
      });
      const sum = data.slice(sel[0], sel[1] + 1).reduce(function (s, d) { return s + d.valor; }, 0);
      const share = sum / total;
      const todas = sel[0] === 0 && sel[1] === 4;

      let rango;
      if (todas) rango = 'en todas las edades';
      else if (sel[0] === 0) rango = 'antes de los ' + (data[sel[1]].hasta + 1) + ' años';
      else if (sel[1] === 4) rango = 'a partir de los ' + data[sel[0]].desde + ' años';
      else rango = 'entre los ' + data[sel[0]].desde + ' y ' + data[sel[1]].hasta + ' años';

      if (todas) {
        // Rango completo: en vez de "10 de cada 10", el total de casos.
        selPctEl.textContent = formatNumber(sum);
        selTxtEl.textContent = 'casos nuevos estimados en total';
      } else {
        // "6 de cada 10"; si es menos del 5%, "3 de cada 100" (evita "0 de cada 10")
        const proporcion = share * 10 < 0.5
          ? Math.round(share * 100) + ' de cada 100'
          : Math.round(share * 10) + ' de cada 10';
        selPctEl.textContent = proporcion;
        selTxtEl.textContent = 'casos ocurren ' + rango + ' (' + formatNumber(sum) + ')';
      }

      selDiaEl.textContent = String(Math.round(sum / 365));
      selDiaTxtEl.textContent = 'diagnósticos por día ' + rango + '.';
    }

    paint(); // estado inicial (o el que haya quedado de un render anterior)
    animateIn(container);
  }

  // ------------------------------------------------------------
  // "Porcentaje" (el waffle) -- SIN CAMBIOS de lógica respecto a la
  // versión anterior: nunca usó el SVG que se sacó del archivo, ya
  // dibujaba con <div> (CSS Grid), igual que ahora "Casos por tipo" y
  // "Casos por edad".
  // ------------------------------------------------------------

  // WAFFLE_GRAYS: los grises que usan en el waffle las categorías que
  // NO son "Mama" (que siempre va en rosa fuerte, para destacarla).
  // No hay una variable de :root para esto porque son colores
  // puntuales de ESTE gráfico nomás, no del resto del sitio.
  // Rango ensanchado (el más claro más claro, el más oscuro más
  // oscuro) para que las 5 categorías se distingan mejor a simple
  // vista -- antes quedaban muy parecidas entre sí, sobre todo las 3
  // del medio.
  const WAFFLE_GRAYS = ['#d6dce3', '#aab2bd', '#7f8794', '#555d68', '#2c313a'];

  // colorForWaffle(d, index): devuelve el color que le toca a un
  // cuadrado del waffle según su categoría: rosa fuerte si es "Mama",
  // o un gris de la lista de arriba (repartidos en orden, repitiendo
  // en ciclo con el "%" si hubiera más de 5 categorías no-Mama).
  function colorForWaffle(d, index) {
    return d.key === 'mama' ? THEME.colors.roseStrong : WAFFLE_GRAYS[(index - 1) % WAFFLE_GRAYS.length];
  }

  // renderWaffleChart(container, data, opts): dibuja el gráfico de
  // "waffle": 100 cuadrados chiquitos (<div>, CSS Grid -- la misma
  // técnica que los puntos del módulo 3), donde cada cuadrado es el
  // 1% de los casos. Al pasar el mouse (o tocar en celular) por una
  // categoría, esa se resalta y el texto grande de al lado cambia
  // para mostrar su dato.
  function renderWaffleChart(container, data, opts) {
    opts = opts || {};
    const subtitle = opts.subtitle || null;

    container.innerHTML = '';
    renderSubtitle(container, subtitle);

    // Invitación a interactuar, con el punto rosa que pulsa -- mismo
    // criterio que .em-prompt-tipo en "Casos por tipo" (grande,
    // centrada, pegada al gráfico), pero esta SIEMPRE queda visible
    // (acá no hay ningún estado "revelado" que la oculte, a diferencia
    // de la de "Casos por tipo"). Antes esta pista vivía pegada al
    // final del subtítulo gris; separada en su propio prompt, puede
    // tener su propio tamaño/color sin agrandar la bajada entera.
    const prompt = document.createElement('div');
    prompt.className = 'em-prompt em-prompt-pct';
    prompt.innerHTML = '<span class="em-prompt-dot" aria-hidden="true"></span>Pasá el cursor o tocá un cuadrado para ver a qué cáncer corresponde.';
    container.appendChild(prompt);

    const body = document.createElement('div');
    body.className = 'em-waffle-body';

    const grid = document.createElement('div');
    grid.className = 'em-waffle-grid';
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', 'Gráfico de 100 cuadrados: ' + data[0].sq + ' corresponden a cáncer de mama');

    const info = document.createElement('div');
    info.className = 'em-waffle-info';

    const headline = document.createElement('p');
    headline.className = 'em-waffle-headline';
    const hlText = document.createElement('p');
    hlText.className = 'em-waffle-hltext';
    const hlMeta = document.createElement('p');
    hlMeta.className = 'em-waffle-hlmeta';

    info.appendChild(headline);
    info.appendChild(hlText);
    info.appendChild(hlMeta);
    body.appendChild(grid);
    body.appendChild(info);
    container.appendChild(body);

    const squares = []; // referencia a cada <div> cuadradito, para poder tocarlos después
    let pinned = null;  // qué categoría quedó "clavada" por un click (null = ninguna)

    // updateHeadline(d): actualiza el texto grande (headline/hlText/
    // hlMeta) para mostrar los datos de la categoría "d" (o de
    // data[0] = "Mama" si no se pasa ninguna, el estado por defecto).
    function updateHeadline(d) {
      const show = d || data[0];
      headline.textContent = show.headline || (show.sq + ' de cada 100');
      headline.style.color = show.key === 'mama' ? THEME.colors.roseStrong : THEME.colors.text;
      hlText.textContent = show.text;
      // toFixed(1) -> siempre 1 decimal (ej "29.9"); .replace('.',',')
      // -> formato argentino ("29,9"). Orden pedido: casos, total,
      // porcentaje al final (antes el % iba pegado a los casos, en
      // el medio -- "20.750 casos (29,9%) de un total de 69.449").
      const pctLbl = show.porcentaje.toFixed(1).replace('.', ',');
      hlMeta.textContent = formatNumber(show.casos) + ' casos de un total de 69.449 (' + pctLbl + '%)';
    }

    // setActive(key, pin): marca una categoría como "activa"
    // (resaltada): le baja la opacidad a TODOS los cuadrados excepto
    // a los de esa categoría, y actualiza el texto grande.
    //   key = la categoría a activar (o null para volver al estado
    //         "nada enfocado")
    //   pin = true cuando viene de un CLICK (no de un simple hover):
    //         en ese caso, "clava" la categoría (pinned) para que
    //         quede resaltada aunque el mouse se vaya -- y si ya
    //         estaba clavada esa misma categoría, un segundo click la
    //         "despina" (vuelve a null).
    function setActive(key, pin) {
      if (pin) key = pinned = (pinned === key ? null : key);
      if (key === null && pinned) key = pinned; // si hay algo clavado, no lo pierde al sacar el mouse
      const d = data.filter(function (x) { return x.key === key; })[0];
      grid.classList.toggle('is-focused', !!d); // baja la opacidad general de la grilla
      squares.forEach(function (sq) { sq.classList.toggle('is-active', !!d && sq.dataset.k === key); });
      updateHeadline(d);
    }

    // Crea los 100 (en realidad, sq1+sq2+...+sq6 = 100) cuadraditos,
    // uno por uno, agrupados por categoría y coloreados según
    // colorForWaffle. Cada cuadrado reacciona a mouseenter/mouseleave
    // (hover) y a click (para "clavar" la categoría).
    data.forEach(function (d, i) {
      const color = colorForWaffle(d, i);
      for (let s = 0; s < d.sq; s++) {
        const sq = document.createElement('div');
        sq.className = 'em-waffle-sq';
        sq.style.background = color;
        sq.dataset.k = d.key;
        sq.addEventListener('mouseenter', function () { setActive(d.key); });
        sq.addEventListener('mouseleave', function () { setActive(pinned); });
        sq.addEventListener('click', function () { setActive(d.key, true); });
        grid.appendChild(sq);
        squares.push(sq);
      }
    });

    updateHeadline(data[0]); // estado inicial: "Mama"

    // Animación de entrada: cada cuadrado aparece (agregándole la
    // clase .is-in, que en el CSS tiene su propia transición de
    // opacity/transform) con un pequeño retraso en cadena (14ms entre
    // uno y el siguiente), así se ve un efecto de "ola" llenando la
    // grilla en vez de aparecer todos de golpe. reduceMotion se saltea
    // la cadena y los muestra directo.
    squares.forEach(function (sq, i) {
      if (reduceMotion) { sq.classList.add('is-in'); return; }
      setTimeout(function () { sq.classList.add('is-in'); }, 200 + i * 14);
    });
  }

  // ============================================================
  // 7. DESPACHADOR: qué función de dibujo le corresponde a cada pestaña
  // ============================================================
  const chartRenderers = {
    casosPorTipo: function (container) {
      renderCasosPorTipo(container);
    },
    casosPorEdad: function (container) {
      renderCasosPorEdad(container);
    },
    porcentaje: function (container) {
      // La pista de interacción ("Pasá el cursor...") ya NO va acá --
      // tiene su propio prompt separado (ver renderWaffleChart), igual
      // criterio que "Casos por tipo". Esta bajada ahora solo da
      // contexto: de dónde sale el 100% del waffle (69.449 casos/año,
      // Argentina 2024).
      renderWaffleChart(container, chapter1Data.porcentaje, {
        subtitle: 'Si tomamos todos los cánceres que se diagnostican en mujeres en Argentina (69.449 casos al año), así se reparten. Cada cuadrado es el 1%. Argentina, 2024.',
      });
    },
  };

  // ============================================================
  // 8. ARRANQUE
  // ============================================================
  const tabs1 = root.querySelectorAll('.em-tab');
  let activeKey = (root.querySelector('.em-tab.active') && root.querySelector('.em-tab.active').dataset.chart) || 'casosPorTipo';

  // render1(): vuelve a dibujar el gráfico activo. Se llama al cargar
  // la página y al clickear una pestaña.
  //
  // NOTA: la versión anterior de este archivo (cuando los gráficos de
  // barras eran <svg>) también la llamaba desde un ResizeObserver,
  // porque el <svg> necesitaba que JS le recalculara el tamaño en
  // píxeles cada vez que cambiaba el ancho del panel. Los gráficos
  // nuevos (este archivo) son <div> normales, 100% responsivos por
  // CSS (flexbox + %, ver modulo1.css) -- ya NO hace falta ese
  // recálculo, así que el ResizeObserver se sacó. Además, mantenerlo
  // causaba un bug real: ocultar/mostrar columnas durante la
  // animación de fusión cambiaba el alto del panel, lo que disparaba
  // un redibujado A MITAD de esa animación (perdiendo el resultado).
  function render1() {
    const renderFn = chartRenderers[activeKey];
    if (renderFn) renderFn(panel1);
  }

  tabs1.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs1.forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeKey = tab.dataset.chart;
      // "Casos por tipo"/"Casos por edad" guardan su estado para que un
      // resize a mitad de interacción no lo borre (ver tipoState/
      // edadState, arriba) -- pero eso también hacía que, al VOLVER a
      // la pestaña después de haber jugado, apareciera tal cual se
      // había dejado (ya revelado/fusionado, o con un rango de edad
      // viejo) en vez de arrancar de cero. Emi pidió lo contrario: que
      // cada click en la pestaña reinicie el estado, así "Casos por
      // tipo" siempre vuelve a mostrar el arrastre desde el principio,
      // y "Casos por edad" siempre arranca en "Menos de 45".
      if (activeKey === 'casosPorTipo') {
        tipoState = { revealed: false, guess: null, merged: false };
      } else if (activeKey === 'casosPorEdad') {
        edadState.sel = [0, 1]; // "Menos de 45" (ver chips, más abajo: { label: 'Menos de 45', r: [0, 1] })
      }
      render1();
    });
  });

  render1(); // primer dibujo, apenas carga la página

  // "Soltar" global para el arrastre de "Casos por edad" (ver
  // edadDragEnd, declarado en la sección 5). Se registra UNA sola vez
  // acá, no adentro de renderCasosPorEdad.
  document.addEventListener('pointerup', function () { edadDragEnd(); });
})();
