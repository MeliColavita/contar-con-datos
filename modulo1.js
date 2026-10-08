// ============================================================
// MODULO1.JS — Capítulo 1 "Argentina hoy" — Emi — prefijo: em-
// ============================================================
// QUÉ HACE ESTE ARCHIVO: dibuja los 3 gráficos de la tarjeta del
// Capítulo 1 (barras "Casos por tipo de cáncer", barras "Casos por
// edad", y el waffle de "Porcentaje"), y maneja el click de las 3
// pestañas que eligen cuál se ve.
//
// CÓMO ESTÁ ORGANIZADO (de arriba a abajo):
//   1. Guarda de entrada (si el HTML del módulo no está, no hace nada)
//   2. Paleta/tipografía (leída de las variables CSS de :root)
//   3. Herramientas genéricas para dibujar SVG a mano (sin librerías)
//   4. Los datos del gráfico (números de GLOBOCAN 2024)
//   5. Las funciones que "renderizan" (dibujan) cada tipo de gráfico
//   6. El "despachador": qué función llamar según la pestaña activa
//   7. El arranque: conecta los clicks de las pestañas y hace el
//      primer dibujo apenas carga la página
//
// Todo el archivo vive adentro de una única función que se ejecuta
// sola -- una "IIFE" (Immediately Invoked Function Expression) -- así
// ninguna de las variables/funciones de acá (THEME, scaleLinear,
// renderBarChart, etc.) queda visible para los otros módulos
// (modulo2.js, modulo3.js). Es la forma de que cada módulo tenga su
// propio "cajón" de JavaScript sin pisarse entre sí.
//
// Qué deja disponible script.js (el archivo general, compartido):
//   - UI.el(tag, attrs): crea un elemento SVG (no se usa en este
//     archivo porque acá se armó un helper propio, svgEl, muy similar)
//   - UI.rng(seed): generador de números pseudo-aleatorios reproducibles
//   - UI.fmt(n): formatea un número con puntos de miles (estilo AR)
//   - El manejo genérico de pestañas .ui-tab/.ui-tabpanel (no se usa
//     acá: las pestañas de este módulo son .em-tab, con su propio
//     look en píldora -- ver el por qué más abajo, en el arranque)
// ============================================================
(function () {
  // root = el contenedor raíz de TODO el módulo (ver index.html:
  // <div class="ui-wrap em-wrap">). Si esta página no tiene ese div
  // (por ejemplo, si alguna vez el HTML del módulo se saca de
  // index.html), root va a ser "null" y cortamos acá mismo: así este
  // script nunca tira un error en páginas donde el módulo no existe.
  const root = document.querySelector('.em-wrap');
  if (!root) return; // el módulo no está en la página

  // panel1 = el <div id="em-chart-panel"> vacío donde se dibuja el
  // gráfico que corresponda según la pestaña activa.
  const panel1 = root.querySelector('#em-chart-panel');
  if (!panel1) return;

  // ============================================================
  // 2. PALETA Y TIPOGRAFÍA
  // ============================================================
  // Los gráficos se dibujan con elementos <svg> puros (sin ninguna
  // librería de gráficos), y los atributos de color de SVG (fill,
  // stroke) necesitan un valor de color YA RESUELTO (ej. "#ff6f9c"),
  // no pueden usar "var(--rose-strong)" directamente como sí se puede
  // en una propiedad de CSS normal.
  //
  // Para no duplicar los colores como texto suelto acá (lo que
  // violaría la regla del equipo de "nada de colores sueltos, usar
  // las variables de :root"), usamos getComputedStyle para LEER el
  // valor real que tiene cada variable en este momento. Si alguna vez
  // se cambia un color en :root (style.css), estos gráficos lo siguen
  // solos, sin tener que tocar este archivo.
  const rootStyle = getComputedStyle(document.documentElement);
  // cssVar('--rose-strong') -> "#ff6f9c" (como string, listo para usar
  // en un atributo fill/stroke de SVG).
  const cssVar = (name) => rootStyle.getPropertyValue(name).trim();

  const THEME = {
    colors: {
      roseStrong: cssVar('--rose-strong'), // rosa fuerte: barras/puntos destacados
      text: cssVar('--text'),              // texto principal (blanco hueso)
      textDim: cssVar('--text-dim'),       // texto secundario (gris rosado apagado)
    },
    fonts: {
      // Mismas familias tipográficas que el resto del sitio (ver
      // --serif/--sans en :root). Google Fonts no siempre se puede
      // "leer" igual que un color con getComputedStyle en todos los
      // navegadores, así que acá se escriben directo (son solo 2
      // nombres, no una paleta de muchos colores que mantener).
      serif: "'Fraunces', Georgia, serif",
      sans: "'Inter', system-ui, sans-serif",
    },
  };

  // PANEL: un segundo objeto más chico, con los colores puntuales que
  // usan los gráficos de barras (texto de las barras + el rosa
  // "difuminado" para las barras que NO están resaltadas).
  const PANEL = {
    text: THEME.colors.text,
    textDim: THEME.colors.textDim,
    barMuted: 'rgba(255,182,206,0.4)', // rosa difuminado para las barras no resaltadas
  };

  // ============================================================
  // 3. HERRAMIENTAS GENÉRICAS PARA DIBUJAR SVG A MANO
  // ============================================================
  // SVG no es HTML normal: sus elementos (<svg>, <rect>, <text>, <g>)
  // pertenecen a un "namespace" (espacio de nombres) distinto. Por
  // eso no alcanza con document.createElement('rect') -- hay que usar
  // document.createElementNS(...) pasándole esta URL fija que indica
  // "esto es SVG, no HTML".
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // svgEl(tag, attrs)
  // Crea UN elemento SVG (ej. 'rect', 'text', 'g') y le aplica todos
  // los atributos que vengan en el objeto "attrs" de un saque.
  // Ejemplo: svgEl('rect', {x:10, y:20, width:5, height:5, fill:'red'})
  // devuelve un <rect x="10" y="20" width="5" height="5" fill="red">
  // (todavía sin agregar al documento -- eso lo hace quien lo llama,
  // con container.appendChild(...)).
  function svgEl(tag, attrs) {
    attrs = attrs || {}; // si no pasan attrs, usamos un objeto vacío
    const el = document.createElementNS(SVG_NS, tag);
    for (const key in attrs) el.setAttribute(key, attrs[key]);
    return el;
  }

  // createChartSVG(container, opts)
  // Prepara un <svg> en blanco, listo para dibujar adentro, y lo deja
  // puesto dentro de "container". Devuelve ese <svg> para que quien
  // llamó siga agregándole elementos (rects, texts, etc.).
  //   opts.width / opts.height: tamaño "lógico" del dibujo (el
  //     viewBox) -- después el CSS (.em-svg) lo escala a lo que mida
  //     realmente en pantalla, así siempre se ve nítido sin importar
  //     el tamaño de la ventana.
  function createChartSVG(container, opts) {
    opts = opts || {};
    const width = opts.width != null ? opts.width : 600;
    const height = opts.height != null ? opts.height : 340;
    container.innerHTML = ''; // limpia cualquier gráfico anterior (al cambiar de pestaña)
    const svg = svgEl('svg', {
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: 'xMidYMid meet', // mantiene la proporción al escalar
    });
    svg.classList.add('em-svg'); // le da el tamaño responsivo real (ver modulo1.css)
    container.appendChild(svg);
    return svg;
  }

  // scaleLinear(domain, range)
  // Una "regla de 3" envuelta en función, igual al concepto de
  // d3.scaleLinear() (pero escrito a mano, sin depender de ninguna
  // librería externa). Sirve para convertir un VALOR DE DATOS (ej.
  // "6213 casos") en una POSICIÓN EN PÍXELES dentro del dibujo.
  //
  //   domain = [valorMínimo, valorMáximo] de los datos reales
  //            (ej. [0, 8000] casos)
  //   range  = [pixelMínimo, pixelMáximo] donde tiene que caer
  //            (ej. [alturaDelGráfico, 0] -- invertido, porque en
  //            pantalla "0" arriba y la altura máxima está abajo)
  //
  // Devuelve una FUNCIÓN que, dado un valor del dominio, calcula su
  // posición en el rango. Ejemplo de uso:
  //   const y = scaleLinear([0, 8000], [300, 0]);
  //   y(6213)  // -> algo cerca de 67 (6213 es casi el máximo, así
  //               que su "y" queda cerca del 0 = arriba del gráfico)
  function scaleLinear(domain, range) {
    const d0 = domain[0], d1 = domain[1];
    const r0 = range[0], r1 = range[1];
    return function (value) {
      // (value - d0) / (d1 - d0): en qué proporción (0 a 1) está
      // "value" dentro del dominio. El "|| 1" evita dividir por 0 si
      // d0 y d1 fueran iguales (dominio de un solo valor).
      return r0 + ((value - d0) / (d1 - d0 || 1)) * (r1 - r0);
    };
  }

  // scaleBand(categories, range, padding)
  // El equivalente a d3.scaleBand(): reparte un conjunto de
  // CATEGORÍAS (ej. ["Mama","Colorrectal",...]) en "bandas" (franjas)
  // del mismo ancho dentro de un rango de píxeles -- es lo que define
  // dónde empieza cada barra y qué tan ancha es.
  //
  //   categories = lista de nombres (ej. las 5 categorías del gráfico)
  //   range      = [pixelInicio, pixelFin] del eje donde se reparten
  //   padding    = 0 a 1: qué porcentaje del ancho de cada "banda" se
  //                deja vacío (de aire) en vez de ser barra. Un
  //                padding más grande = barras más angostas y más
  //                separadas entre sí (ver el ajuste de 0.35 -> 0.55
  //                más abajo, en renderBarChart).
  //
  // Devuelve un objeto con:
  //   .position(categoria) -> en qué píxel (x o y) empieza esa banda
  //   .bandwidth            -> ancho (en píxeles) de cada barra
  function scaleBand(categories, range, padding) {
    padding = padding != null ? padding : 0.3; // 30% de aire por defecto
    const r0 = range[0], r1 = range[1];
    const step = (r1 - r0) / categories.length; // ancho total de CADA banda (barra + aire)
    const bandwidth = step * (1 - padding);     // ancho que ocupa SOLO la barra
    const positions = {};
    categories.forEach(function (cat, i) {
      // (step - bandwidth) / 2: centra la barra dentro de su banda,
      // repartiendo el aire mitad a la izquierda, mitad a la derecha.
      positions[cat] = r0 + step * i + (step - bandwidth) / 2;
    });
    return {
      position: function (cat) { return positions[cat]; },
      bandwidth: bandwidth,
    };
  }

  // formatNumber(n)
  // Convierte un número en un string con el formato de la Argentina
  // (punto como separador de miles): 20750 -> "20.750".
  function formatNumber(n) {
    return new Intl.NumberFormat('es-AR').format(n);
  }

  // animateIn(el, delay)
  // Hace aparecer un elemento con un fundido + un pequeño desliz hacia
  // arriba (de 8px abajo a su posición final), en vez de aparecer de
  // golpe. Se usa después de terminar de armar cada gráfico, para que
  // la tarjeta completa (no cada barra suelta) entre con un efecto
  // prolijo.
  //   1. Lo pone invisible y corrido 8px hacia abajo (el "antes" de
  //      la animación).
  //   2. requestAnimationFrame espera al próximo frame de pintado del
  //      navegador, para asegurarse de que el "antes" realmente se
  //      haya pintado una vez antes de animar (si no, el navegador
  //      podría saltearse directo al estado final y no se vería
  //      ninguna animación).
  //   3. setTimeout (con el delay que le pasen, 0 si no se especifica)
  //      recién ahí cambia a opacity:1 y transform:none -- como esos
  //      dos valores tienen "transition" puesta, el cambio se ve
  //      animado en vez de instantáneo.
  function animateIn(el, delay) {
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
  // 4. DATOS (verificados contra el Excel de la fuente)
  // ============================================================
  // Fuente de TODOS los números de este módulo: GLOBOCAN 2024
  // (IARC/OMS) — archivo CancerGlobalMujeres2024.xlsx.
  // Si algún día cambia un número, se cambia ACÁ, en un solo lugar
  // (nunca escrito "a mano" repetido dentro de las funciones de abajo).

  // chapter1Stats: los 2 datos sueltos que acompañan al gráfico
  // "Casos por tipo de cáncer" (se muestran con renderInlineStats).
  //   - 66,2 = ASR (World) de "Breast" (6623 ÷ 100 = 66,23 casos cada
  //     100.000 mujeres, tasa ajustada por edad).
  const chapter1Stats = [
    { valor: '66,2', label: 'casos cada 100.000 mujeres (tasa ajustada por edad)' },
    { valor: '1°', label: 'Cáncer más frecuente en mujeres' },
  ];

  // chapter1EdadStats: los 2 datos sueltos que acompañan al gráfico
  // "Casos por edad".
  //   - 60,2% = (6.213 + 6.278) ÷ 20.750 → grupos 45-59 y 60-74
  //   - 21,85% = (549 + 3.984) ÷ 20.750 → grupos 15-29 y 30-44
  const chapter1EdadStats = [
    { valor: '60,2%', label: 'de los casos estimados ocurren entre los 45 y 74 años.' },
    { valor: '21,85%', label: 'de los casos estimados ocurren antes de los 45 años.' },
  ];

  // chapter1Data: los datos de cada uno de los 3 gráficos, agrupados
  // bajo la misma clave ("casosPorTipo", "casosPorEdad", "porcentaje")
  // que usan los botones de pestaña (atributo data-chart en el HTML)
  // para saber cuál les toca dibujar.
  const chapter1Data = {
    // Top 5 cánceres más frecuentes en mujeres en Argentina, 2024.
    casosPorTipo: [
      { categoria: 'Mama', valor: 20750 },
      { categoria: 'Colorrectal', valor: 7698 },
      { categoria: 'Cuello uterino', valor: 4679 },
      { categoria: 'Pulmón', valor: 4469 },
      { categoria: 'Tiroides', valor: 3370 },
    ],
    // Casos de cáncer de mama por grupo etario en Argentina, 2024.
    casosPorEdad: [
      { categoria: '15-29', valor: 549 },
      { categoria: '30-44', valor: 3984 },
      { categoria: '45-59', valor: 6213 },
      { categoria: '60-74', valor: 6278 },
      { categoria: '+75', valor: 3726 },
    ],
    // Distribución de TODOS los cánceres en mujeres, AR 2024 (69.449
    // casos en total), para el gráfico de waffle (los 100 cuadrados):
    //   - "sq" = cuántos de los 100 cuadrados le tocan a esa categoría
    //     (los 6 valores de "sq" suman exactamente 100).
    //   - "key" = identificador corto, se usa en el HTML/CSS para
    //     saber qué cuadrados pertenecen a cada categoría al hacer
    //     hover/click.
    porcentaje: [
      { key: 'mama', categoria: 'Mama', porcentaje: 29.9, sq: 30, casos: 20750, headline: '3 de cada 10', text: 'cánceres diagnosticados en mujeres son de mama' },
      { key: 'crc', categoria: 'Colorrectal', porcentaje: 11.1, sq: 11, casos: 7698, text: 'son colorrectales' },
      { key: 'cu', categoria: 'Cuello uterino', porcentaje: 6.7, sq: 7, casos: 4679, text: 'son de cuello uterino' },
      { key: 'pul', categoria: 'Pulmón', porcentaje: 6.4, sq: 6, casos: 4469, text: 'son de pulmón' },
      { key: 'tir', categoria: 'Tiroides', porcentaje: 4.9, sq: 5, casos: 3370, text: 'son de tiroides' },
      { key: 'otr', categoria: 'Otros', porcentaje: 41.0, sq: 41, casos: 28483, text: 'corresponden a otros tipos de cáncer' },
    ],
  };

  // ============================================================
  // 5. RENDERIZADO DE GRÁFICOS
  // ============================================================

  // renderSubtitle(container, subtitle, beforeEl)
  // Crea el párrafo de bajada ("Casos nuevos estimados en mujeres...")
  // arriba de cada gráfico, usando la clase compartida .ui-sub (ver
  // style.css) para que el tamaño de letra sea igual al del módulo 3.
  //   container = dónde insertarlo
  //   subtitle  = el texto (si viene vacío/undefined, no crea nada)
  //   beforeEl  = opcional: un elemento de referencia para insertar el
  //               párrafo JUSTO ANTES de él (se usa para que quede
  //               antes del <svg>, en vez de al final del contenedor)
  function renderSubtitle(container, subtitle, beforeEl) {
    if (!subtitle) return;
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'ui-sub'; // componente compartido, mismo tamaño que el módulo 3
    subtitleEl.textContent = subtitle;
    if (beforeEl) container.insertBefore(subtitleEl, beforeEl);
    else container.appendChild(subtitleEl);
  }

  // renderBarChart(container, data, opts)
  // Dibuja un gráfico de BARRAS VERTICALES dentro de "container",
  // usando los puntos "data" (cada uno con {categoria, valor}).
  // Se usa para "Casos por edad" siempre, y para "Casos por tipo de
  // cáncer" cuando la tarjeta tiene ancho suficiente (si no, se usa
  // la versión horizontal de más abajo).
  //
  //   opts.highlightFirst       -> si es true, resalta en rosa fuerte
  //                                 SOLO la primera categoría de la
  //                                 lista (el resto en rosa apagado)
  //   opts.highlightCategories  -> en vez de "la primera", una lista
  //                                 puntual de categorías a resaltar
  //                                 (ej. ["45-59","60-74"])
  //   opts.maxValue             -> valor máximo fijo del eje Y (si no
  //                                 se pasa, se calcula del dato más
  //                                 alto de "data")
  //   opts.subtitle             -> texto de bajada (ver renderSubtitle)
  //   opts.xAxisLabel           -> título chico debajo del eje X
  //                                 (ej. "Años")
  function renderBarChart(container, data, opts) {
    opts = opts || {};
    const highlightFirst = !!opts.highlightFirst;
    const highlightCategories = opts.highlightCategories || null;
    const maxValue = opts.maxValue != null ? opts.maxValue : null;
    const subtitle = opts.subtitle || null;
    const xAxisLabel = opts.xAxisLabel || null;

    // ---- Medidas del dibujo ----
    // width = ancho real que tiene el contenedor en este momento
    // (clientWidth se recalcula solo cada vez que se llama a esta
    // función, así el gráfico queda siempre ajustado al ancho actual
    // de pantalla -- ver el ResizeObserver al final del archivo).
    //
    // height: antes era ancho×0.58 con un piso de 220px (un gráfico
    // bastante alto). Se achicó a ancho×0.3 con piso de 160px para
    // que la tarjeta de este capítulo quedara pareja en altura con la
    // del capítulo 3 (que no tiene un gráfico tan grande).
    const width = container.clientWidth || 600;
    const height = Math.max(160, Math.round(width * 0.3)) + (xAxisLabel ? 18 : 0);
    // margin = el "marco" interno del dibujo: espacio reservado
    // arriba/derecha/abajo/izquierda ANTES de empezar a dibujar las
    // barras, para que entren las etiquetas de valor, categoría y el
    // título del eje X sin cortarse.
    const margin = { top: 16, right: 16, bottom: xAxisLabel ? 38 : 26, left: 8 };
    const innerW = width - margin.left - margin.right;   // ancho útil para las barras
    const innerH = height - margin.top - margin.bottom;  // alto útil para las barras

    const svg = createChartSVG(container, { width: width, height: height });
    renderSubtitle(container, subtitle, svg); // el subtítulo se inserta ANTES del <svg>
    // <g> = un "grupo" de SVG. Mover el grupo entero con un solo
    // transform:translate(...) es más simple que sumarle margin.left/
    // margin.top a la posición de cada barra/texto por separado.
    const g = svgEl('g', { transform: 'translate(' + margin.left + ',' + margin.top + ')' });
    svg.appendChild(g);

    const categories = data.map(function (d) { return d.categoria; });
    // Si no se pasó un maxValue fijo, lo calculamos como el mayor
    // valor de los datos (con un piso de 1, para nunca dividir por 0
    // si todos los valores fueran 0).
    const maxVal = maxValue != null ? maxValue : Math.max(1, Math.max.apply(null, data.map(function (d) { return d.valor; })));

    // x: ESCALA DE BANDA -> en qué posición horizontal (y qué ancho)
    // le toca a cada categoría. padding 0.55 (antes 0.35) = barras
    // más angostas y más separadas entre sí, en vez de ocupar casi
    // todo el ancho de su "banda".
    const x = scaleBand(categories, [0, innerW], 0.55);
    // y: ESCALA LINEAL -> convierte un valor de datos en una altura
    // en píxeles. Range invertido [innerH, 0] porque en pantalla
    // "y=0" es ARRIBA: un valor chico tiene que terminar con una "y"
    // grande (cerca del piso del gráfico), uno grande con una "y"
    // chica (cerca de la parte de arriba).
    const y = scaleLinear([0, maxVal], [innerH, 0]);

    // Dibuja una barra + su etiqueta de categoría + su valor, por
    // cada elemento de "data".
    data.forEach(function (d) {
      const barX = x.position(d.categoria);
      const barY = y(d.valor);       // dónde empieza (arriba) la barra
      const barH = innerH - barY;    // alto de la barra (desde "barY" hasta el piso)

      // Elige el color: si hay highlightCategories, resalta esas
      // puntuales; si no, si highlightFirst, resalta solo la primera;
      // si ninguna de las dos, TODAS las barras van en rosa fuerte.
      let color;
      if (highlightCategories) {
        color = highlightCategories.indexOf(d.categoria) !== -1 ? THEME.colors.roseStrong : PANEL.barMuted;
      } else if (highlightFirst) {
        color = categories.indexOf(d.categoria) === 0 ? THEME.colors.roseStrong : PANEL.barMuted;
      } else {
        color = THEME.colors.roseStrong;
      }

      // La barra arranca con height:0 (invisible, "aplastada" contra
      // el piso) y recién en el próximo frame (requestAnimationFrame)
      // se le pone su height/y reales CON transición -- por eso crece
      // animada desde abajo en vez de aparecer ya dibujada.
      const rect = svgEl('rect', { x: barX, y: innerH, width: x.bandwidth, height: 0, rx: 4, fill: color });
      g.appendChild(rect);

      requestAnimationFrame(function () {
        rect.style.transition = 'y .7s ease, height .7s ease';
        rect.setAttribute('y', barY);
        rect.setAttribute('height', barH);
      });

      // Etiqueta de categoría, debajo de la barra (ej. "Mama").
      const label = svgEl('text', {
        x: barX + x.bandwidth / 2, y: innerH + 16,
        'text-anchor': 'middle', fill: PANEL.text,
        'font-family': THEME.fonts.sans, 'font-size': 11,
      });
      label.textContent = d.categoria;
      g.appendChild(label);

      // Etiqueta de valor, arriba de la barra (ej. "20.750").
      const value = svgEl('text', {
        x: barX + x.bandwidth / 2, y: barY - 8,
        'text-anchor': 'middle', fill: PANEL.text,
        'font-family': THEME.fonts.sans, 'font-size': 13, 'font-weight': 600,
      });
      value.textContent = formatNumber(d.valor);
      g.appendChild(value);
    });

    // Título chico del eje X (ej. "Años"), solo si se pidió uno.
    if (xAxisLabel) {
      // y:innerH+34 -- adentro de margin.bottom:38 (con un poco de
      // aire antes del borde), ya no del margin.bottom:54 original.
      const axisLabel = svgEl('text', {
        x: innerW / 2, y: innerH + 34,
        'text-anchor': 'middle', fill: PANEL.textDim,
        'font-family': THEME.fonts.sans, 'font-size': 11, 'font-style': 'italic',
      });
      axisLabel.textContent = xAxisLabel;
      g.appendChild(axisLabel);
    }

    animateIn(container); // fundido + desliz de entrada de la tarjeta completa
  }

  // renderBarChartHorizontal(container, data, opts)
  // La misma idea que renderBarChart, pero con las barras acostadas
  // (categoría a la izquierda, barra creciendo hacia la derecha). Se
  // usa SOLO para "Por tipo de cáncer" cuando el ancho de la tarjeta
  // es angosto (ver HORIZONTAL_BREAKPOINT más abajo) -- así
  // "Cuello uterino" (el nombre más largo) nunca se aprieta ni se
  // corta en 2 líneas.
  // Mismos "opts" que renderBarChart, excepto que acá highlightFirst
  // es la única opción de resaltado (no se usa highlightCategories
  // en ningún gráfico horizontal del sitio).
  function renderBarChartHorizontal(container, data, opts) {
    opts = opts || {};
    const highlightFirst = !!opts.highlightFirst;
    const maxValue = opts.maxValue != null ? opts.maxValue : null;
    const subtitle = opts.subtitle || null;
    const xAxisLabel = opts.xAxisLabel || null;

    // rowH reducido (antes 40) y padding de scaleBand más grande (antes
    // 0.3) para el mismo objetivo que renderBarChart: tarjeta más baja
    // y barras más finas, parejo con el Capítulo 3.
    const width = container.clientWidth || 320;
    const rowH = 30; // alto fijo de cada fila (una por categoría)
    const margin = { top: 6, right: 54, bottom: xAxisLabel ? 28 : 6, left: 96 };
    const innerW = width - margin.left - margin.right;
    const innerH = rowH * data.length; // el alto total depende de CUÁNTAS categorías hay
    const height = innerH + margin.top + margin.bottom;

    const svg = createChartSVG(container, { width: width, height: height });
    renderSubtitle(container, subtitle, svg);
    const g = svgEl('g', { transform: 'translate(' + margin.left + ',' + margin.top + ')' });
    svg.appendChild(g);

    const categories = data.map(function (d) { return d.categoria; });
    const maxVal = maxValue != null ? maxValue : Math.max(1, Math.max.apply(null, data.map(function (d) { return d.valor; })));

    // Acá se invierten los roles respecto al gráfico vertical: "y" es
    // la escala de BANDA (una fila por categoría) y "x" es la escala
    // LINEAL (el largo de la barra según el valor).
    const y = scaleBand(categories, [0, innerH], 0.5);
    const x = scaleLinear([0, maxVal], [0, innerW]);

    data.forEach(function (d) {
      const barY = y.position(d.categoria);
      const barW = x(d.valor);
      const color = highlightFirst ? (categories.indexOf(d.categoria) === 0 ? THEME.colors.roseStrong : PANEL.barMuted) : THEME.colors.roseStrong;

      // Igual que en el gráfico vertical: arranca con width:0 y crece
      // animada hacia la derecha.
      const rect = svgEl('rect', { x: 0, y: barY, width: 0, height: y.bandwidth, rx: 4, fill: color });
      g.appendChild(rect);

      requestAnimationFrame(function () {
        rect.style.transition = 'width .7s ease';
        rect.setAttribute('width', barW);
      });

      // Etiqueta de categoría, a la IZQUIERDA de la barra (text-anchor
      // "end" = el texto termina justo en el punto x que le dimos).
      const label = svgEl('text', {
        x: -10, y: barY + y.bandwidth / 2 + 4, 'text-anchor': 'end',
        fill: PANEL.text, 'font-family': THEME.fonts.sans, 'font-size': 12,
      });
      label.textContent = d.categoria;
      g.appendChild(label);

      // Etiqueta de valor, a la DERECHA de la punta de la barra.
      const value = svgEl('text', {
        x: barW + 8, y: barY + y.bandwidth / 2 + 4, 'text-anchor': 'start',
        fill: PANEL.text, 'font-family': THEME.fonts.sans, 'font-size': 13, 'font-weight': 600,
      });
      value.textContent = formatNumber(d.valor);
      g.appendChild(value);
    });

    if (xAxisLabel) {
      const axisLabel = svgEl('text', {
        x: innerW / 2, y: innerH + 20,
        'text-anchor': 'middle', fill: PANEL.textDim,
        'font-family': THEME.fonts.sans, 'font-size': 11, 'font-style': 'italic',
      });
      axisLabel.textContent = xAxisLabel;
      g.appendChild(axisLabel);
    }

    animateIn(container);
  }

  // HORIZONTAL_BREAKPOINT: ancho (en píxeles) del contenedor por
  // debajo del cual "Casos por tipo de cáncer" pasa de barras
  // verticales a horizontales (ver chartRenderers.casosPorTipo).
  const HORIZONTAL_BREAKPOINT = 420;

  // WAFFLE_GRAYS: los grises que usan en el waffle las categorías que
  // NO son "Mama" (que siempre va en rosa fuerte, para destacarla).
  // No hay una variable de :root para esto porque son colores
  // puntuales de ESTE gráfico nomás, no del resto del sitio.
  const WAFFLE_GRAYS = ['#a3abb6', '#838b97', '#67707c', '#515963', '#353a43'];

  // colorForWaffle(d, index)
  // Devuelve el color que le toca a un cuadrado del waffle según su
  // categoría: rosa fuerte si es "Mama", o un gris de la lista de
  // arriba (repartidos en orden, repitiendo en ciclo con el "%" si
  // hubiera más de 5 categorías no-Mama).
  function colorForWaffle(d, index) {
    return d.key === 'mama' ? THEME.colors.roseStrong : WAFFLE_GRAYS[(index - 1) % WAFFLE_GRAYS.length];
  }

  // renderWaffleChart(container, data, opts)
  // Dibuja el gráfico de "waffle": 100 cuadrados chiquitos (<div>,
  // NO SVG -- usa CSS Grid, la misma técnica que los puntos del
  // módulo 3), donde cada cuadrado es el 1% de los casos. Al pasar el
  // mouse (o tocar en celular) por una categoría, esa se resalta y el
  // texto grande de al lado cambia para mostrar su dato.
  function renderWaffleChart(container, data, opts) {
    opts = opts || {};
    const subtitle = opts.subtitle || null;

    container.innerHTML = ''; // limpia el gráfico anterior
    renderSubtitle(container, subtitle);

    // ---- Arma la estructura HTML del waffle a mano ----
    // body: envuelve la grilla + el texto informativo (uno al lado
    //       del otro desde 680px de ancho, apilados en mobile -- ver
    //       modulo1.css, .em-waffle-body).
    const body = document.createElement('div');
    body.className = 'em-waffle-body';

    // grid: el contenedor de los 100 cuadrados.
    const grid = document.createElement('div');
    grid.className = 'em-waffle-grid';
    grid.setAttribute('role', 'img'); // para lectores de pantalla: se lee como una sola imagen
    grid.setAttribute('aria-label', 'Gráfico de 100 cuadrados: ' + data[0].sq + ' corresponden a cáncer de mama');

    // info: el texto grande (headline + 2 líneas de detalle) que
    // cambia según qué categoría está "enfocada".
    const info = document.createElement('div');
    info.className = 'em-waffle-info';

    const headline = document.createElement('p'); // "3 de cada 10"
    headline.className = 'em-waffle-headline';
    const hlText = document.createElement('p');    // "cánceres diagnosticados... son de mama"
    hlText.className = 'em-waffle-hltext';
    const hlMeta = document.createElement('p');    // "20.750 casos (29,9%) de un total de 69.449"
    hlMeta.className = 'em-waffle-hlmeta';

    info.appendChild(headline);
    info.appendChild(hlText);
    info.appendChild(hlMeta);
    body.appendChild(grid);
    body.appendChild(info);
    container.appendChild(body);

    const squares = []; // referencia a cada <div> cuadradito, para poder tocarlos después
    let pinned = null;  // qué categoría quedó "clavada" por un click (null = ninguna)

    // updateHeadline(d)
    // Actualiza el texto grande (headline/hlText/hlMeta) para mostrar
    // los datos de la categoría "d" (o de data[0] = "Mama" si no se
    // pasa ninguna, el estado por defecto).
    function updateHeadline(d) {
      const show = d || data[0];
      headline.textContent = show.headline || (show.sq + ' de cada 100');
      headline.style.color = show.key === 'mama' ? THEME.colors.roseStrong : THEME.colors.text;
      hlText.textContent = show.text;
      // toFixed(1) -> siempre 1 decimal (ej "29.9"); .replace('.',',')
      // -> formato argentino ("29,9").
      const pctLabel = show.porcentaje.toFixed(1).replace('.', ',');
      hlMeta.textContent = formatNumber(show.casos) + ' casos (' + pctLabel + '%) de un total de 69.449';
    }

    // setActive(key, pin)
    // Marca una categoría como "activa" (resaltada): le baja la
    // opacidad a TODOS los cuadrados excepto a los de esa categoría,
    // y actualiza el texto grande.
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
        sq.dataset.k = d.key; // guarda a qué categoría pertenece este cuadrado
        sq.addEventListener('mouseenter', function () { setActive(d.key); });
        sq.addEventListener('mouseleave', function () { setActive(pinned); }); // vuelve a lo clavado (o a nada)
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
    // grilla en vez de aparecer todos de golpe.
    // matchMedia('(prefers-reduced-motion: reduce)') respeta la
    // preferencia de accesibilidad del sistema operativo de "reducir
    // movimiento": si está activada, se saltea la animación en
    // cadena y los cuadrados aparecen directo.
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    squares.forEach(function (sq, i) {
      if (reduceMotion) { sq.classList.add('is-in'); return; }
      setTimeout(function () { sq.classList.add('is-in'); }, 200 + i * 14);
    });
  }

  // renderInlineStats(container, stats)
  // Dibuja la fila de "datos sueltos" que va al pie de los gráficos
  // de barras (ej. "66,2 casos cada 100.000..." + "1° Cáncer más
  // frecuente..."). "stats" es un array de {valor, label} (ver
  // chapter1Stats / chapter1EdadStats, arriba).
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
  }

  // ============================================================
  // 6. DESPACHADOR: qué función de dibujo le corresponde a cada
  //    pestaña
  // ============================================================
  // chartRenderers es un objeto donde cada CLAVE coincide exactamente
  // con el atributo "data-chart" de cada botón .em-tab en el HTML
  // (ver index.html: data-chart="casosPorTipo", etc.). Así, al
  // clickear una pestaña, alcanza con buscar
  // chartRenderers[esaClave] y llamarla -- sin un "if/else" gigante
  // comparando nombres.
  const chartRenderers = {
    // "Casos por tipo de cáncer": decide EN EL MOMENTO (según el
    // ancho actual del panel) si usar barras verticales u
    // horizontales, y después agrega los 2 datos sueltos
    // (chapter1Stats) al pie.
    casosPorTipo: function (container) {
      const opts = {
        highlightFirst: true, // resalta "Mama" (siempre es la primera de la lista)
        maxValue: 25000,
        subtitle: 'Casos nuevos estimados en mujeres, por tipo de cáncer. Argentina, 2024.',
        xAxisLabel: 'Top 5 cánceres frecuentes',
      };
      const width = container.clientWidth || 600;
      if (width < HORIZONTAL_BREAKPOINT) {
        renderBarChartHorizontal(container, chapter1Data.casosPorTipo, opts);
      } else {
        renderBarChart(container, chapter1Data.casosPorTipo, opts);
      }
      renderInlineStats(container, chapter1Stats);
    },
    // "Casos por edad": siempre barras verticales (los nombres de
    // categoría -- "45-59", "60-74" -- son cortos, nunca se aprietan).
    casosPorEdad: function (container) {
      renderBarChart(container, chapter1Data.casosPorEdad, {
        maxValue: 8000,
        subtitle: 'Casos nuevos estimados en mujeres, por edad. Argentina, 2024.',
        highlightCategories: ['45-59', '60-74'], // franja etaria con más casos
        xAxisLabel: 'Años',
      });
      renderInlineStats(container, chapter1EdadStats);
    },
    // "Porcentaje": el waffle de 100 cuadrados.
    porcentaje: function (container) {
      renderWaffleChart(container, chapter1Data.porcentaje, {
        subtitle: 'Distribución de los casos nuevos estimados de cáncer en mujeres. Argentina, 2024. Cada cuadrado es el 1% de los casos.',
      });
    },
  };

  // ============================================================
  // 7. ARRANQUE: conecta los clicks de las pestañas, dibuja el
  //    primer gráfico, y vuelve a dibujar si cambia el ancho
  // ============================================================
  // tabs1: los 3 botones .em-tab (ver index.html). Son propios de
  // este módulo (NO las .ui-tab compartidas que script.js ya maneja
  // solas) porque acá el diseño es otro -- píldora, 3 en un solo
  // renglón siempre -- y conviene manejar el click acá mismo, junto
  // con el redibujado del gráfico.
  const tabs1 = root.querySelectorAll('.em-tab');

  // activeKey: qué gráfico está activo ahora. Arranca leyendo cuál
  // pestaña YA tiene la clase .active en el HTML (por si en algún
  // momento se decide que no sea siempre la primera por defecto); si
  // ninguna la tiene, usa 'casosPorTipo' como opción por defecto.
  let activeKey = (root.querySelector('.em-tab.active') && root.querySelector('.em-tab.active').dataset.chart) || 'casosPorTipo';

  // render1()
  // Vuelve a dibujar, de cero, el gráfico que le corresponde a
  // "activeKey" en el panel. Se llama: al cargar la página, al
  // clickear una pestaña, y cada vez que el panel cambia de tamaño
  // (ver ResizeObserver más abajo) -- así los gráficos SVG, que
  // calculan su tamaño en base al ancho del contenedor, siempre
  // quedan bien proporcionados.
  function render1() {
    const renderFn = chartRenderers[activeKey];
    if (renderFn) renderFn(panel1);
  }

  // Click en cualquiera de las 3 pestañas: le saca "active"/
  // aria-selected a TODAS, se la pone solo a la clickeada, actualiza
  // activeKey, y vuelve a dibujar.
  tabs1.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs1.forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeKey = tab.dataset.chart;
      render1();
    });
  });

  render1(); // primer dibujo, apenas carga la página

  // ResizeObserver: vuelve a llamar a render1() cada vez que el
  // panel cambia de tamaño (por ejemplo, al rotar el celular, al
  // redimensionar la ventana, o al mostrar/ocultar el menú lateral en
  // mobile) -- así el gráfico SIEMPRE se recalcula para el ancho
  // actual, en vez de quedar con el tamaño que tenía al cargar.
  const ro1 = new ResizeObserver(function () { render1(); });
  ro1.observe(panel1);
})();
