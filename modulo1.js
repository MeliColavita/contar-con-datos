// ============================================================
// MODULO1.JS — Emi — prefijo: em-
// Gráficos del Capítulo 1 "Argentina hoy": casos por tipo de cáncer,
// casos por edad, y distribución en waffle. Todo adentro de esta
// función para no chocar con los otros módulos.
// Disponible desde script.js: UI.el(tag, attrs), UI.rng(seed), UI.fmt(n), UI.NS
// Las pestañas .em-tab son propias de este módulo (no las .ui-tab
// compartidas que ya funcionan solas, ver script.js), porque acá el
// look es otro (píldora) y se necesitan en un solo renglón siempre.
// ============================================================
(function () {
  const root = document.querySelector('.em-wrap');
  if (!root) return; // el módulo no está en la página

  const panel1 = root.querySelector('#em-chart-panel');
  if (!panel1) return;

  // ---------- Paleta y tipografía ----------
  // Lee los valores reales de las variables de :root (style.css) en
  // vez de duplicarlos como strings sueltos acá: si algún día cambia
  // un color en :root, estos gráficos SVG lo siguen automáticamente.
  const rootStyle = getComputedStyle(document.documentElement);
  const cssVar = (name) => rootStyle.getPropertyValue(name).trim();
  const THEME = {
    colors: {
      roseStrong: cssVar('--rose-strong'),
      text: cssVar('--text'),
      textDim: cssVar('--text-dim'),
    },
    fonts: {
      serif: "'Fraunces', Georgia, serif",
      sans: "'Inter', system-ui, sans-serif",
    },
  };

  const PANEL = {
    text: THEME.colors.text,
    textDim: THEME.colors.textDim,
    barMuted: 'rgba(255,182,206,0.4)', // rosa difuminado para las barras no resaltadas
  };

  // ---------- Herramientas genéricas de SVG ----------
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    attrs = attrs || {};
    const el = document.createElementNS(SVG_NS, tag);
    for (const key in attrs) el.setAttribute(key, attrs[key]);
    return el;
  }

  function createChartSVG(container, opts) {
    opts = opts || {};
    const width = opts.width != null ? opts.width : 600;
    const height = opts.height != null ? opts.height : 340;
    container.innerHTML = '';
    const svg = svgEl('svg', {
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: 'xMidYMid meet',
    });
    svg.classList.add('em-svg');
    container.appendChild(svg);
    return svg;
  }

  function scaleLinear(domain, range) {
    const d0 = domain[0], d1 = domain[1];
    const r0 = range[0], r1 = range[1];
    return function (value) { return r0 + ((value - d0) / (d1 - d0 || 1)) * (r1 - r0); };
  }

  function scaleBand(categories, range, padding) {
    padding = padding != null ? padding : 0.3;
    const r0 = range[0], r1 = range[1];
    const step = (r1 - r0) / categories.length;
    const bandwidth = step * (1 - padding);
    const positions = {};
    categories.forEach(function (cat, i) {
      positions[cat] = r0 + step * i + (step - bandwidth) / 2;
    });
    return { position: function (cat) { return positions[cat]; }, bandwidth: bandwidth };
  }

  function formatNumber(n) {
    return new Intl.NumberFormat('es-AR').format(n);
  }

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

  // ---------- Datos, verificados contra el Excel ----------
  // Fuente: GLOBOCAN 2024 — CancerGlobalMujeres2024.xlsx

  //   - 66,2 = ASR (World) de "Breast" (6623 ÷ 100 = 66,23 casos cada
  //     100.000 mujeres, tasa ajustada por edad).
  const chapter1Stats = [
    { valor: '66,2', label: 'casos cada 100.000 mujeres (tasa ajustada por edad)' },
    { valor: '1°', label: 'Cáncer más frecuente en mujeres' },
  ];

  //   - 60,2% = (6.213 + 6.278) ÷ 20.750 → grupos 45-59 y 60-74
  //   - 21,85% = (549 + 3.984) ÷ 20.750 → grupos 15-29 y 30-44
  const chapter1EdadStats = [
    { valor: '60,2%', label: 'de los casos estimados ocurren entre los 45 y 74 años.' },
    { valor: '21,85%', label: 'de los casos estimados ocurren antes de los 45 años.' },
  ];

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
    // Distribución de todos los cánceres en mujeres, AR 2024 (69.449
    // casos), para el waffle: "sq" = cuántos de los 100 cuadrados le
    // tocan a cada categoría (suman exactamente 100).
    porcentaje: [
      { key: 'mama', categoria: 'Mama', porcentaje: 29.9, sq: 30, casos: 20750, headline: '3 de cada 10', text: 'cánceres diagnosticados en mujeres son de mama' },
      { key: 'crc', categoria: 'Colorrectal', porcentaje: 11.1, sq: 11, casos: 7698, text: 'son colorrectales' },
      { key: 'cu', categoria: 'Cuello uterino', porcentaje: 6.7, sq: 7, casos: 4679, text: 'son de cuello uterino' },
      { key: 'pul', categoria: 'Pulmón', porcentaje: 6.4, sq: 6, casos: 4469, text: 'son de pulmón' },
      { key: 'tir', categoria: 'Tiroides', porcentaje: 4.9, sq: 5, casos: 3370, text: 'son de tiroides' },
      { key: 'otr', categoria: 'Otros', porcentaje: 41.0, sq: 41, casos: 28483, text: 'corresponden a otros tipos de cáncer' },
    ],
  };

  // ---------- Renderizado de gráficos ----------

  function renderSubtitle(container, subtitle, beforeEl) {
    if (!subtitle) return;
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'ui-sub'; // componente compartido, mismo tamaño que el módulo 3
    subtitleEl.textContent = subtitle;
    if (beforeEl) container.insertBefore(subtitleEl, beforeEl);
    else container.appendChild(subtitleEl);
  }

  // Barras verticales (usado por "casos por edad" y por "por tipo de
  // cáncer" cuando el ancho alcanza). highlightCategories resalta
  // categorías puntuales en rosa fuerte (el resto en rosa difuminado);
  // xAxisLabel dibuja un título debajo del eje X (ej. "Años").
  function renderBarChart(container, data, opts) {
    opts = opts || {};
    const highlightFirst = !!opts.highlightFirst;
    const highlightCategories = opts.highlightCategories || null;
    const maxValue = opts.maxValue != null ? opts.maxValue : null;
    const subtitle = opts.subtitle || null;
    const xAxisLabel = opts.xAxisLabel || null;

    // Altura reducida (antes ancho×0.58, piso 220) para que la tarjeta
    // del Capítulo 1 mida parecido a la del Capítulo 3 -- ver medición
    // en el comentario de más arriba del archivo. Igual de legible,
    // solo más compacto.
    const width = container.clientWidth || 600;
    const height = Math.max(160, Math.round(width * 0.3)) + (xAxisLabel ? 18 : 0);
    const margin = { top: 16, right: 16, bottom: xAxisLabel ? 38 : 26, left: 8 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = createChartSVG(container, { width: width, height: height });
    renderSubtitle(container, subtitle, svg);
    const g = svgEl('g', { transform: 'translate(' + margin.left + ',' + margin.top + ')' });
    svg.appendChild(g);

    const categories = data.map(function (d) { return d.categoria; });
    const maxVal = maxValue != null ? maxValue : Math.max(1, Math.max.apply(null, data.map(function (d) { return d.valor; })));

    // padding 0.55 (antes 0.35) = barras más angostas y más separadas
    // entre sí, en vez de ocupar casi todo el ancho de su "banda".
    const x = scaleBand(categories, [0, innerW], 0.55);
    const y = scaleLinear([0, maxVal], [innerH, 0]);

    data.forEach(function (d) {
      const barX = x.position(d.categoria);
      const barY = y(d.valor);
      const barH = innerH - barY;
      let color;
      if (highlightCategories) {
        color = highlightCategories.indexOf(d.categoria) !== -1 ? THEME.colors.roseStrong : PANEL.barMuted;
      } else if (highlightFirst) {
        color = categories.indexOf(d.categoria) === 0 ? THEME.colors.roseStrong : PANEL.barMuted;
      } else {
        color = THEME.colors.roseStrong;
      }

      const rect = svgEl('rect', { x: barX, y: innerH, width: x.bandwidth, height: 0, rx: 4, fill: color });
      g.appendChild(rect);

      requestAnimationFrame(function () {
        rect.style.transition = 'y .7s ease, height .7s ease';
        rect.setAttribute('y', barY);
        rect.setAttribute('height', barH);
      });

      const label = svgEl('text', {
        x: barX + x.bandwidth / 2, y: innerH + 16,
        'text-anchor': 'middle', fill: PANEL.text,
        'font-family': THEME.fonts.sans, 'font-size': 11,
      });
      label.textContent = d.categoria;
      g.appendChild(label);

      const value = svgEl('text', {
        x: barX + x.bandwidth / 2, y: barY - 8,
        'text-anchor': 'middle', fill: PANEL.text,
        'font-family': THEME.fonts.sans, 'font-size': 13, 'font-weight': 600,
      });
      value.textContent = formatNumber(d.valor);
      g.appendChild(value);
    });

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

    animateIn(container);
  }

  // Barras horizontales: se usa para "Por tipo de cáncer" en pantallas
  // angostas, para que "Cuello uterino" no se apriete.
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
    const rowH = 30;
    const margin = { top: 6, right: 54, bottom: xAxisLabel ? 28 : 6, left: 96 };
    const innerW = width - margin.left - margin.right;
    const innerH = rowH * data.length;
    const height = innerH + margin.top + margin.bottom;

    const svg = createChartSVG(container, { width: width, height: height });
    renderSubtitle(container, subtitle, svg);
    const g = svgEl('g', { transform: 'translate(' + margin.left + ',' + margin.top + ')' });
    svg.appendChild(g);

    const categories = data.map(function (d) { return d.categoria; });
    const maxVal = maxValue != null ? maxValue : Math.max(1, Math.max.apply(null, data.map(function (d) { return d.valor; })));

    const y = scaleBand(categories, [0, innerH], 0.5);
    const x = scaleLinear([0, maxVal], [0, innerW]);

    data.forEach(function (d) {
      const barY = y.position(d.categoria);
      const barW = x(d.valor);
      const color = highlightFirst ? (categories.indexOf(d.categoria) === 0 ? THEME.colors.roseStrong : PANEL.barMuted) : THEME.colors.roseStrong;

      const rect = svgEl('rect', { x: 0, y: barY, width: 0, height: y.bandwidth, rx: 4, fill: color });
      g.appendChild(rect);

      requestAnimationFrame(function () {
        rect.style.transition = 'width .7s ease';
        rect.setAttribute('width', barW);
      });

      const label = svgEl('text', {
        x: -10, y: barY + y.bandwidth / 2 + 4, 'text-anchor': 'end',
        fill: PANEL.text, 'font-family': THEME.fonts.sans, 'font-size': 12,
      });
      label.textContent = d.categoria;
      g.appendChild(label);

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

  // Umbral de ancho (px) por debajo del cual "Por tipo de cáncer" pasa
  // a barras horizontales.
  const HORIZONTAL_BREAKPOINT = 420;

  // Grises para las categorías del waffle que no son "Mama" (no hay
  // variable de :root para esto: son grises neutros solo de este
  // gráfico, no del resto del sitio).
  const WAFFLE_GRAYS = ['#a3abb6', '#838b97', '#67707c', '#515963', '#353a43'];

  function colorForWaffle(d, index) {
    return d.key === 'mama' ? THEME.colors.roseStrong : WAFFLE_GRAYS[(index - 1) % WAFFLE_GRAYS.length];
  }

  // Waffle: 100 cuadrados = 100% de los casos. Grilla CSS de <div>, no
  // SVG. Hover/click resalta una categoría y actualiza el titular.
  function renderWaffleChart(container, data, opts) {
    opts = opts || {};
    const subtitle = opts.subtitle || null;

    container.innerHTML = '';
    renderSubtitle(container, subtitle);

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

    const squares = [];
    let pinned = null;

    function updateHeadline(d) {
      const show = d || data[0];
      headline.textContent = show.headline || (show.sq + ' de cada 100');
      headline.style.color = show.key === 'mama' ? THEME.colors.roseStrong : THEME.colors.text;
      hlText.textContent = show.text;
      const pctLabel = show.porcentaje.toFixed(1).replace('.', ',');
      hlMeta.textContent = formatNumber(show.casos) + ' casos (' + pctLabel + '%) de un total de 69.449';
    }

    function setActive(key, pin) {
      if (pin) key = pinned = (pinned === key ? null : key);
      if (key === null && pinned) key = pinned;
      const d = data.filter(function (x) { return x.key === key; })[0];
      grid.classList.toggle('is-focused', !!d);
      squares.forEach(function (sq) { sq.classList.toggle('is-active', !!d && sq.dataset.k === key); });
      updateHeadline(d);
    }

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

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    squares.forEach(function (sq, i) {
      if (reduceMotion) { sq.classList.add('is-in'); return; }
      setTimeout(function () { sq.classList.add('is-in'); }, 200 + i * 14);
    });
  }

  // Datos sueltos integrados dentro de la tarjeta (tabs "Por tipo de
  // cáncer" y "Por edad").
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

  // Qué dibujar por cada tab (data-chart del botón -> función).
  const chartRenderers = {
    casosPorTipo: function (container) {
      const opts = {
        highlightFirst: true,
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
    casosPorEdad: function (container) {
      renderBarChart(container, chapter1Data.casosPorEdad, {
        maxValue: 8000,
        subtitle: 'Casos nuevos estimados en mujeres, por edad. Argentina, 2024.',
        highlightCategories: ['45-59', '60-74'],
        xAxisLabel: 'Años',
      });
      renderInlineStats(container, chapter1EdadStats);
    },
    porcentaje: function (container) {
      renderWaffleChart(container, chapter1Data.porcentaje, {
        subtitle: 'Distribución de los casos nuevos estimados de cáncer en mujeres. Argentina, 2024. Cada cuadrado es el 1% de los casos.',
      });
    },
  };

  // ---------- Arranque: tabs + primer render + redibujo al resize ----------
  const tabs1 = root.querySelectorAll('.em-tab');
  let activeKey = (root.querySelector('.em-tab.active') && root.querySelector('.em-tab.active').dataset.chart) || 'casosPorTipo';

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
      render1();
    });
  });

  render1();
  const ro1 = new ResizeObserver(function () { render1(); });
  ro1.observe(panel1);
})();
