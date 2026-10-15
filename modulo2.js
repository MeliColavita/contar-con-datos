// ============================================================
// MODULO2.JS — Capítulo 2 "El tiempo" — Brenda — prefijo: br-
// ============================================================
// QUÉ HACE ESTE ARCHIVO: dibuja el mapa interactivo de Argentina por
// provincia (con tooltip al pasar el mouse y un gráfico de barras que
// cambia según la provincia elegida), y la pestaña "Por año" (un
// segundo mapa + un gráfico de dispersión de la evolución 2005-2024).
// Requiere Chart.js (se carga como <script> en index.html, ANTES que
// este archivo, para que la variable global "Chart" ya exista).
//
// ESTRUCTURA DEL ARCHIVO (de arriba a abajo):
//   (A) DATOS -- el objeto DATA.provinces: ~12.800 líneas de
//       coordenadas SVG (una por cada provincia, el contorno + los
//       "anillos" usados para calcular dónde caen los puntitos de
//       densidad). Es DATO PURO, no lógica -- nunca se tocó ni hace
//       falta tocarlo para nada de lo que se hizo hoy (fluidez, techo
//       de alto del mapa, el fix del gráfico en blanco). Si alguna
//       vez hay que actualizar el mapa en sí (otro año, otra fuente),
//       es acá donde se reemplazarían esas coordenadas.
//   (B) Pestaña "Por provincia" -- arma el mapa interactivo, el
//       tooltip, los puntitos de densidad y el gráfico de barras.
//       Corre apenas carga la página (esta pestaña está activa por
//       defecto).
//   (C) Pestañas + pestaña "Por año" -- el click de las 2 pestañas, y
//       el segundo mapa + el gráfico de dispersión (que se arman
//       recién la PRIMERA vez que se clickea "Por año" -- carga
//       diferida, para no hacer ese trabajo si nadie la visita nunca).
//
// Todo vive adentro de una única función que se ejecuta sola (IIFE),
// igual que los otros 2 módulos -- así ninguna variable de acá
// (DATA, pathEls, provinceChart, etc.) queda visible para
// modulo1.js/modulo3.js ni los pisa.
// ============================================================
(function () {
  // root = el contenedor raíz del módulo (ver index.html:
  // <div class="ui-wrap br-wrap">). Si no existe, esta página no
  // tiene el módulo 2 cargado -- cortamos acá, sin error.
  const root = document.querySelector('.br-wrap');
  if (!root) return; // el módulo no está en la página

  // ---------- (A) DATOS ----------
  // DATA.width/height: el tamaño del "lienzo" original del mapa (el
  // viewBox que usan los 2 <svg class="br-map">, ver index.html).
  // DATA.provinces: un objeto por provincia con su nombre, el path
  // SVG completo ("d", el contorno dibujado) y "rings" (los mismos
  // contornos pero como listas de puntos [x,y], que usa pickPoint()
  // en la sección B para calcular dónde caen los puntitos de densidad
  // sin que queden fuera de la silueta de la provincia). Es dato puro
  // -- no se modificó ni hace falta tocarlo hoy.
  const DATA = MAPA_PROVINCIAS;

  // ============================================================
  // (B) Pestaña "Por provincia"
  // ============================================================
  // Todo esto corre adentro de su propia IIFE, apenas carga la
  // página (esta pestaña está activa por defecto, a diferencia de
  // "Por año" -- sección C -- que recién arma SU mapa/gráfico la
  // primera vez que se clickea).
  (function () {
    // ---------- utilidades geométricas ----------
    // Estas 4 funciones trabajan juntas para resolver un problema
    // concreto: "¿en qué punto [x,y] DENTRO de la silueta de esta
    // provincia dibujo cada puntito de densidad, sin que caiga afuera
    // del contorno (por ejemplo, en el mar o en otra provincia)?"

    // ringArea(ring)
    // Calcula el ÁREA de un polígono (un "ring" = una lista de puntos
    // [x,y] que forman un contorno cerrado), con la fórmula estándar
    // del "shoelace". Se usa para elegir, en provincias con más de un
    // contorno (islas, enclaves), cuál de ellos es más grande y por
    // lo tanto dónde "le toca" proporcionalmente más puntos.
    function ringArea(ring) {
      let a = 0;
      for (let i = 0; i < ring.length; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[(i + 1) % ring.length];
        a += x1 * y2 - x2 * y1;
      }
      return Math.abs(a / 2);
    }
    // pointInRing(x, y, ring)
    // ¿El punto [x,y] cae DENTRO del polígono "ring"? (algoritmo de
    // "ray casting": cuenta cuántas veces una línea horizontal desde
    // el punto hacia la derecha cruza los bordes del polígono -- un
    // número impar de cruces = está adentro). Se usa para descartar
    // puntos "candidatos" que caerían fuera de la silueta real.
    function pointInRing(x, y, ring) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i],
          [xj, yj] = ring[j];
        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }
    // mulberry32(seed)
    // Generador de números "aleatorios" pero REPRODUCIBLES: con la
    // misma seed, siempre da la misma secuencia de números. Así los
    // puntitos de densidad de cada provincia quedan siempre en el
    // mismo lugar entre una carga de página y la siguiente, en vez de
    // "bailar" cada vez que se recarga (mismo concepto que UI.rng en
    // script.js, usado por los otros 2 módulos -- acá está reescrito
    // en vez de reutilizar ese helper, pero hace lo mismo).
    function mulberry32(seed) {
      return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    // seedFromName(name)
    // Convierte el NOMBRE de una provincia (ej. "Córdoba") en un
    // número -- ese número se usa como "seed" de mulberry32(), así
    // cada provincia tiene su propia secuencia reproducible de
    // puntos (dos provincias nunca generan exactamente el mismo
    // patrón, pero la MISMA provincia sí da siempre el mismo patrón).
    function seedFromName(name) {
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
      return h;
    }
    // pickPoint(province, rng)
    // Elige UN punto [x,y] al azar (reproducible, usando "rng") que
    // caiga DENTRO de la silueta real de "province" -- se llama una
    // vez por cada puntito de densidad que haya que dibujar.
    //   1. Si la provincia tiene más de un contorno (rings), elige
    //      cuál de ellos usar, con más chance para el más grande
    //      (ringArea) -- así los puntos se reparten proporcional al
    //      tamaño real de cada parte, no 50/50 entre una isla chica
    //      y el territorio principal.
    //   2. Calcula el rectángulo que ENVUELVE ese contorno (minX/
    //      maxX/minY/maxY).
    //   3. Prueba hasta 250 puntos al azar DENTRO de ese rectángulo,
    //      y se queda con el primero que caiga adentro del contorno
    //      real (pointInRing) -- no todo rectángulo está lleno de
    //      provincia, por eso hace falta probar varias veces.
    //   4. Si ninguno de los 250 intentos cae adentro (provincia muy
    //      angosta/irregular), devuelve un punto cerca del centroide
    //      como respaldo, para no trabarse.
    function pickPoint(province, rng) {
      const rings = province.rings;
      if (!rings.length) return province.centroid;
      const areas = rings.map(ringArea);
      const totalArea = areas.reduce((a, b) => a + b, 0) || 1;
      let r = rng() * totalArea,
        ringIdx = 0;
      for (let i = 0; i < areas.length; i++) {
        r -= areas[i];
        if (r <= 0) {
          ringIdx = i;
          break;
        }
        ringIdx = i;
      }
      const ring = rings[ringIdx];
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      ring.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });
      const w = maxX - minX,
        h = maxY - minY;
      for (let attempt = 0; attempt < 250; attempt++) {
        const x = minX + rng() * w;
        const y = minY + rng() * h;
        if (pointInRing(x, y, ring)) return [x, y];
      }
      const jr = Math.max(w, h, 4) * 0.25;
      return [province.centroid[0] + (rng() - 0.5) * jr, province.centroid[1] + (rng() - 0.5) * jr];
    }

    // ---------- construir el mapa ----------
    // svg = el <svg id="brMap"> vacío del HTML; le ponemos el viewBox
    // acá por código (en vez de dejarlo fijo en el HTML) para que
    // quede atado al mismo DATA.width/height que usa el resto del
    // archivo, en un solo lugar.
    const svg = document.getElementById('brMap');
    svg.setAttribute('viewBox', `0 0 ${DATA.width} ${DATA.height}`);
    const mapCard = document.querySelector('.br-map-card'); // el <div> que envuelve este mapa (ver modulo2.css)
    const tooltip = document.getElementById('brTooltip');
    const ttName = document.getElementById('brTtName');
    const ttPct = document.getElementById('brTtPct');

    const promptProv = document.getElementById('brProvPrompt');

    const pathEls = []; // referencia a cada <path> de provincia + sus datos, para no recorrer el DOM de nuevo después
    // Los datos de CABA ya están sumados dentro de "Buenos Aires":
    // acá solo definimos qué provincias se resaltan juntas.
    const GROUPED_PROVINCES = {
      'Buenos Aires': ['Buenos Aires', 'CABA'],
      CABA: ['Buenos Aires', 'CABA'],
    };

    // Provincia seleccionada con click (null = ninguna)
    let selectedKey = null;

    // CABA se trata como Buenos Aires (sus datos ya están sumados ahí)
    const keyOf = (p) => (p.name === 'CABA' ? 'Buenos Aires' : p.name);
    const dataFor = (p) => DATA.provinces.find((pr) => pr.name === keyOf(p));

    // resalta la provincia p (y su grupo, ej. Buenos Aires + CABA)
    function highlight(p) {
      const group = GROUPED_PROVINCES[p.name] || [p.name];
      pathEls.forEach((o) => o.el.classList.toggle('active', group.includes(o.data.name)));
    }

    DATA.provinces.forEach((p) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', p.d);
      path.setAttribute('class', 'br-province');
      path.setAttribute('data-name', p.name);
      svg.appendChild(path);
      pathEls.push({ el: path, data: p });

      // Pasar el cursor
      path.addEventListener('pointerenter', (e) => {
        if (promptProv) promptProv.classList.add('br-prompt-gone');

        // Hay OTRA provincia seleccionada: solo el nombre, sin datos y sin tocar el gráfico
        if (selectedKey !== null && keyOf(p) !== selectedKey) {
          showTooltip(p, e, true);
          return;
        }

        // Sin selección (o sobre la seleccionada): todo como siempre
        const d = dataFor(p);
        highlight(p);
        showTooltip(d, e);
        updateProvinceChart(d);
      });
      path.addEventListener('pointermove', positionTooltip);
      path.addEventListener('pointerleave', () => tooltip.classList.remove('visible'));

      // Click: selecciona; si ya era la seleccionada, la deselecciona
      path.addEventListener('click', (e) => {
        if (promptProv) promptProv.classList.add('br-prompt-gone');
        selectedKey = selectedKey === keyOf(p) ? null : keyOf(p);
        svg.classList.toggle('has-selection', selectedKey !== null); // lo usa el CSS (cambio 3)
        const d = dataFor(p);
        highlight(p);
        showTooltip(d, e);
        updateProvinceChart(d);
      });
    });

    // ---------- Año seleccionado + puntos de densidad ----------
    // 1 punto = 20 muertes por cáncer de mama en el año elegido.
    const DEATHS_PER_DOT = 20;
    const YEAR_PROV_MAX = 2024;
    let provYear = YEAR_PROV_MAX; // año que se está mostrando
    let activeProvData = null; // provincia que está mostrando el gráfico ahora

    const dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dotsGroup.setAttribute('class', 'br-dots');
    svg.appendChild(dotsGroup);

    // Guarda las posiciones ya calculadas de cada provincia: al mover el slider
    // solo se calculan los puntos nuevos que falten, el resto se reutiliza.
    const dotCache = {};
    function dotsOf(p, n) {
      let c = dotCache[p.name];
      if (!c) c = dotCache[p.name] = { rng: mulberry32(seedFromName(p.name)), pts: [] };
      while (c.pts.length < n) c.pts.push(pickPoint(p, c.rng));
      return c.pts.slice(0, n);
    }

    function drawDots() {
      dotsGroup.textContent = ''; // borra los puntos anteriores
      DATA.provinces.forEach((p) => {
        const n = p.cancer > 0 ? Math.max(1, Math.round(p.cancer / DEATHS_PER_DOT)) : 0;
        dotsOf(p, n).forEach(([x, y]) => {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('cx', x.toFixed(1));
          c.setAttribute('cy', y.toFixed(1));
          c.setAttribute('r', 2.8);
          dotsGroup.appendChild(c);
        });
      });
    }

    // Pisa total/cancer/pct de cada provincia con los datos del año elegido.
    // CABA queda en 0: sus muertes ya están dentro de Buenos Aires en el archivo.
    function applyProvYear(year) {
      provYear = year;
      DATA.provinces.forEach((p) => {
        if (p.name === 'CABA') {
          p.total = 0;
          p.cancer = 0;
          p.pct = 0;
          return;
        }
        const serie = PROVINCIAS_POR_ANIO[p.name];
        const d = serie && serie[year];
        if (d) {
          p.total = d.total;
          p.cancer = d.mama;
          p.pct = d.pct;
        }
      });
      drawDots();
    }
    applyProvYear(YEAR_PROV_MAX);

    // positionTooltip(e)
    // Calcula dónde poner el tooltip (el globo flotante) según la
    // posición del mouse ("e", el evento), relativa a "mapCard" (el
    // <div> que envuelve el mapa).
    //   scale = rect.width / mapCard.offsetWidth: antes de hoy, la
    //   tarjeta entera se "achicaba" con transform:scale() (ver el
    //   "auto-escalado" que había en este archivo, ya eliminado) --
    //   esta cuenta estaba pensada para DESHACER ese achicado al
    //   calcular la posición. Ahora que ya no hay escalado, "rect.width"
    //   y "mapCard.offsetWidth" son siempre iguales, así que "scale"
    //   da 1 y la cuenta sigue funcionando igual, sin tener que tocar
    //   esta función -- quedó "a prueba" del cambio de hoy sin querer.
    //   half/margin: deja un margen para que el tooltip nunca se pase
    //   del borde izquierdo/derecho de la tarjeta, aunque el mouse
    //   esté pegado al borde.
    function positionTooltip(e) {
      const rect = mapCard.getBoundingClientRect();
      const widget = mapCard.closest('.br-widget'); // la tarjeta principal (la que recorta con overflow:hidden)
      const wRect = widget.getBoundingClientRect();
      const scale = rect.width / mapCard.offsetWidth || 1;
      const half = (tooltip.offsetWidth || 180) / 2;
      const tipH = tooltip.offsetHeight || 60;
      const margin = 6;

      // Horizontal: se limita a los bordes de la tarjeta principal, no solo a los del mapa.
      let x = (e.clientX - rect.left) / scale;
      const minX = (wRect.left - rect.left) / scale + half + margin;
      const maxX = (wRect.right - rect.left) / scale - half - margin;
      x = Math.max(minX, Math.min(maxX, x));

      // Vertical: por defecto va arriba del cursor (translateY -115%).
      // Si arriba no entra, pasa a ir abajo del cursor.
      const y = (e.clientY - rect.top) / scale;
      const noEntraArriba = e.clientY - tipH * 1.15 < wRect.top + margin;
      tooltip.style.transform = noEntraArriba ? 'translate(-50%, 22px)' : 'translate(-50%, -115%)';

      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }
    // showTooltip(p, e): pone el texto del tooltip (nombre de
    // provincia + porcentaje) y lo hace visible, posicionándolo con
    // positionTooltip().
    function showTooltip(p, e, soloNombre) {
      ttName.textContent = p.name;
      ttPct.style.display = soloNombre ? 'none' : ''; // oculta la línea de datos
      if (!soloNombre) {
        ttPct.innerHTML = `<b>${p.cancer.toLocaleString('es-AR')}</b> muertes por cáncer de mama en ${provYear}`;
      }
      tooltip.classList.add('visible');
      positionTooltip(e);
    }

    // ---------- Chart.js ----------
    // El gráfico de barras ("Muertes totales vs. cáncer de mama") de
    // la provincia seleccionada. Chart.js es una librería externa
    // (cargada por CDN en index.html) -- acá solo se configura.
    const chartCtx = document.getElementById('brProvinceChart').getContext('2d'); // Chart.js dibuja sobre el "2d context" del canvas, no sobre el canvas directamente
    const chartTitleEl = document.getElementById('brChartTitle');

    // valueLabelsPlugin: un "plugin" de Chart.js hecho a mano, que
    // dibuja el NÚMERO arriba de cada barra (Chart.js no lo hace
    // solo). afterDatasetsDraw se ejecuta automáticamente cada vez
    // que el gráfico termina de dibujar sus barras -- ahí, por cada
    // barra de cada dataset ("Muertes totales" y "Muertes por cáncer
    // de mama"), escribe su valor justo arriba.
    const valueLabelsPlugin = {
      id: 'valueLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, i) => {
          const meta = chart.getDatasetMeta(i);
          meta.data.forEach((bar, index) => {
            const value = dataset.data[index];
            ctx.save();
            ctx.fillStyle = '#f2e9ee';
            ctx.font = '600 13px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(value.toLocaleString('es-AR'), bar.x, bar.y - 6);
            ctx.restore();
          });
        });
      },
    };

    // El gráfico en sí: arranca en 0/0 (sin datos todavía -- los
    // carga updateProvinceChart(), más abajo, apenas termina de
    // crearse). "labels:['']" = una sola "categoría" sin nombre
    // (las 2 barras van juntas, una al lado de la otra, no una por
    // categoría distinta -- por eso el eje X no necesita etiquetas).
    //   responsive:true + maintainAspectRatio:false: el gráfico se
    //   redibuja solo cuando cambia el tamaño de su <canvas> (el alto
    //   lo fija un estilo inline en el HTML, el ancho lo da la
    //   columna -- ver .br-grid-layout en modulo2.css).
    const provinceChart = new Chart(chartCtx, {
      type: 'bar',
      data: {
        labels: [''],
        datasets: [
          {
            label: ['Todos los', ' cánceres'],
            data: [0],
            backgroundColor: 'rgba(169, 154, 166, 0.55)',
            borderRadius: 4,
            barThickness: 70,
          },
          {
            label: ['Cáncer de', ' mama'],
            data: [0],
            backgroundColor: '#ff6f9c',
            borderRadius: 4,
            barThickness: 70,
          },
        ],
      },
      plugins: [valueLabelsPlugin],
      options: {
        events: [],
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 24 } },
        plugins: {
          legend: {
            position: 'right',
            maxWidth: 130,
            labels: { color: '#f2e9ee', boxWidth: 14, padding: 12, font: { size: 14 } },
            title: {
              display: true,
              text: ' ',
              color: 'transparent',
              font: { size: 1 },
              padding: { top: 16 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const lbl = Array.isArray(ctx.dataset.label)
                  ? ctx.dataset.label.join(' ')
                  : ctx.dataset.label;
                return ` ${lbl}: ${ctx.parsed.y.toLocaleString('es-AR')}`;
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: '#a99aa6' }, grid: { display: false } },
          y: {
            min: 0,
            max: 16000,
            ticks: {
              color: '#a99aa6',
              stepSize: 4000,
              callback: (v) => v.toLocaleString('es-AR'),
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
        },
      },
    });

    function updateProvinceChart(p) {
      activeProvData = p; // la recordamos para poder redibujar al mover el slider
      provinceChart.data.datasets[0].data = [p.total];
      provinceChart.data.datasets[1].data = [p.cancer];
      provinceChart.update();
      chartTitleEl.textContent = p.name;

      const pctEl = document.getElementById('brChartPct');
      if (pctEl) {
        const pct = p.pct.toLocaleString('es-AR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
        pctEl.innerHTML = `<b>${pct}%</b> de las muertes por cáncer fueron por cáncer de mama`;
      }
    }

    // selección inicial: Buenos Aires (con CABA resaltada junto con ella)
    const initial = pathEls.find((o) => o.data.name === 'Buenos Aires');
    if (initial) {
      const group = GROUPED_PROVINCES['Buenos Aires'];
      pathEls.forEach((o) => {
        if (group.includes(o.data.name)) o.el.classList.add('active');
      });
      updateProvinceChart(initial.data);
    }

    // ---------- Slider de año ----------
    const sliderProv = document.getElementById('brProvYear');
    const lblProv = document.getElementById('brProvYearLbl');
    sliderProv.addEventListener('input', () => {
      const y = Number(sliderProv.value);
      lblProv.textContent = y;
      applyProvYear(y);
      if (activeProvData) updateProvinceChart(activeProvData);
      tooltip.classList.remove('visible');
    });
  })();

  // ============================================================
  // (C) Pestañas + pestaña "Por año"
  // ============================================================
  // Estas pestañas NO usan el mecanismo compartido .ui-tab/
  // .ui-tabpanel (el que script.js maneja solo para los otros
  // módulos): acá hace falta código propio porque, además de
  // mostrar/ocultar un panel, clickear "Por año" tiene que disparar
  // la construcción del segundo mapa + el gráfico de dispersión (ver
  // initYearTab(), más abajo) -- y eso solo tiene que pasar UNA vez,
  // la primera vez que se visita esa pestaña (carga diferida).
  (function () {
    const tabProvincia = document.getElementById('brTabProvincia');
    const tabAnio = document.getElementById('brTabAnio');
    const panelProvincia = document.getElementById('brPanelProvincia');
    const panelAnio = document.getElementById('brPanelAnio');

    const brTitle = document.getElementById('brTitle');
    const TITLE_ANIO = '¿Está bajando la mortalidad por cáncer de mama?';
    const TITLE_PROV = '¿Qué lugar ocupa el cáncer de mama en cada provincia?';

    // Fuente: un solo botón, el texto cambia según la pestaña.
    const srcBox = document.getElementById('brSrc');
    const FUENTE_DEIS = {
      // Lo que muestra "Fuente" en cada pestaña (lo arma uiFuente, en script.js).
      autor: 'DEIS (s.f.)',
      etiqueta: 'Muertes por cáncer, año a año',
      url: 'https://www.argentina.gob.ar/salud/deis/datos/defunciones',
    };
    const SRC_ANIO = [
      FUENTE_DEIS,
      {
        autor: 'INDEC (2004)',
        etiqueta: 'Estimación de población femenina 2005-2009',
        url: 'https://biblioteca.indec.gob.ar/bases/minde/4si20_30.pdf',
      },
      {
        autor: 'INDEC (2013)',
        etiqueta: 'Estimación de población femenina 2010-2024',
        url: 'https://www.indec.gob.ar/ftp/cuadros/publicaciones/proyeccionesyestimaciones_nac_2010_2040.pdf',
      },
      {
        autor: 'DEIS (2022)',
        etiqueta: 'Estadísticas vitales 2020',
        url: 'https://www.argentina.gob.ar/sites/default/files/serie5numero64_web.pdf',
      },
    ];
    const SRC_PROV = [FUENTE_DEIS];
    const srcRow = document.querySelector('.br-src-row');

    const SUB_ANIO = 'Muertes por cáncer de mama cada 100.000 mujeres. Argentina, 2005–2024.';
    const SUB_PROV =
      'Muertes por cáncer de mama por provincia y por año, 2005–2024. Cada punto equivale a 20 muertes. ' +
      'Las provincias más pobladas tienen más puntos: no indica mayor riesgo.';
    const srcSub = document.getElementById('brSrcSub');

    // ---------- Notas que se abren al pasar el cursor por ciertos años ----------
    // Cada clave es un año de la serie; el valor es el texto (puede llevar <br>)
    // que se muestra en el desplegable "Fuente" mientras el cursor esté sobre ese año.
    const NOTAS_ANIO = {
      2015: 'Variación interanual sin causa oficial identificada. Tasa bruta, sin ajuste por edad.',
      2017: 'Variación interanual sin causa oficial identificada. Tasa bruta, sin ajuste por edad.',
      2020:
        'Año de pandemia. Hubo demoras en el procesamiento de las estadísticas vitales y ' +
        'cambios en la clasificación de causas por la covid-19.',
    };
    // Año cuya nota está abierta en este momento (null = ninguna). Sirve para
    // 1) no reescribir el texto en cada movimiento del mouse, y
    // 2) saber si hay algo que restaurar al salir, sin pisar un "Fuente"
    //    que el usuario haya abierto a mano con un click.
    let notaAnioActual = null;

    function setFuente(fuentes) {
      notaAnioActual = null; // al cambiar de pestaña, cualquier nota queda descartada
      uiFuente(srcBox, fuentes); // también cierra el desplegable
    }

    // Si el año tiene nota, la guarda y pide redibujar el gráfico (la dibuja el
    // plugin "notaEnGrafico", en buildScatter); si no, la borra.
    function mostrarNotaAnio(year) {
      if (!NOTAS_ANIO[year]) {
        ocultarNotaAnio();
        return;
      }
      if (notaAnioActual === year) return; // ya está mostrada esa nota
      notaAnioActual = year;
      if (scatterChart) scatterChart.draw();
    }

    function ocultarNotaAnio() {
      if (notaAnioActual === null) return;
      notaAnioActual = null;
      if (scatterChart) scatterChart.draw();
    }

    // animarEntrada(panel)
    // Vuelve a disparar la animación .br-fade-in (ver @keyframes
    // brFadeIn en modulo2.css) en "panel". Sacarle la clase y
    // ponérsela de nuevo no alcanza por sí solo -- el navegador no
    // "re-dispara" una animación CSS si la clase ya estaba puesta
    // antes sin un reflow de por medio. "void panel.offsetWidth"
    // fuerza ese reflow (lee una propiedad de layout, lo que obliga
    // al navegador a procesar el cambio anterior antes de seguir) --
    // mismo truco que usa script.js para reiniciar la animación de
    // los puntitos del título al cambiar de capítulo.
    function animarEntrada(panel) {
      panel.classList.remove('br-fade-in');
      void panel.offsetWidth;
      panel.classList.add('br-fade-in');
    }

    // Chart.getChart(id) busca, por el id de su <canvas>, la instancia
    // de Chart.js ya creada -- sin esto hacía falta tener la variable
    // "provinceChart"/"scatterChart" a mano, pero esas se declaran en
    // otra IIFE (sección B, más arriba) que no es visible desde acá.
    //
    // resizeChart() fuerza a Chart.js a volver a medir su <canvas> y
    // redibujarse. Hace falta porque, al ocultar un panel con
    // "br-hidden" (display:none) y volver a mostrarlo, Chart.js no
    // siempre vuelve a detectar solo el tamaño correcto del canvas
    // (es un comportamiento conocido de la librería con contenedores
    // que pasan por display:none) -- sin este resize manual, el
    // gráfico podía quedar en blanco al volver a una pestaña ya
    // visitada antes.
    function resizeChart(canvasId) {
      const chart = typeof Chart !== 'undefined' && Chart.getChart(canvasId);
      if (chart) chart.resize();
    }

    // Click en cada pestaña: le saca/pone "active" a los 2 botones,
    // muestra el panel que corresponde y oculta el otro (con
    // "br-hidden"), dispara la animación de entrada, y fuerza que
    // Chart.js vuelva a medir su gráfico (resizeChart -- ver más
    // arriba por qué hace falta). "Por año" además llama a
    // initYearTab(), que arma el segundo mapa + el gráfico de
    // dispersión la primera vez (y no hace nada las veces siguientes).
    tabProvincia.addEventListener('click', () => {
      tabProvincia.classList.add('active');
      tabAnio.classList.remove('active');
      panelProvincia.classList.remove('br-hidden');
      panelAnio.classList.add('br-hidden');
      animarEntrada(panelProvincia);
      resizeChart('brProvinceChart');

      // Pista rosa de "Por provincia": reaparece cada vez que se vuelve a esta pestaña.
      const promptProvEl = document.getElementById('brProvPrompt');
      if (promptProvEl) {
        promptProvEl.classList.remove('br-prompt-gone');
        promptProvEl.classList.remove('br-hidden'); // <-- NUEVA: la muestra
      }
      srcSub.textContent = SUB_PROV;
      if (brTitle) brTitle.textContent = TITLE_PROV;
      uiFuenteSalir(srcBox, function () {
        setFuente(SRC_PROV);
      });
    });
    tabAnio.addEventListener('click', () => {
      tabAnio.classList.add('active');
      tabProvincia.classList.remove('active');
      panelAnio.classList.remove('br-hidden');
      panelProvincia.classList.add('br-hidden');
      initYearTab();
      animarEntrada(panelAnio);
      resizeChart('brAnioScatter');

      // PISTA ROSA: cada vez que se vuelve a "Por año", reaparece.
      // >>> SI QUERÉS QUE, UNA VEZ OCULTA, NO VUELVA A APARECER <<<
      // borrá (o comentá) estas 2 líneas.
      const promptProvOff = document.getElementById('brProvPrompt');
      if (promptProvOff) promptProvOff.classList.add('br-hidden'); // <-- NUEVA: la oculta
      const promptAnioEl = document.getElementById('brAnioPrompt');
      if (promptAnioEl) promptAnioEl.classList.remove('br-prompt-gone');
      resetAnio();
      srcSub.textContent = SUB_ANIO;
      if (brTitle) brTitle.textContent = TITLE_ANIO;
      uiFuenteSalir(srcBox, function () {
        setFuente(SRC_ANIO);
      });
    });

    // YEAR_DATA: un dato por año (2005-2024) para el gráfico de
    // dispersión y el mapa "Por año".
    // mama = muertes por cáncer de mama (mujeres)
    // total = muertes por cáncer total (mujeres)
    // tasa = muertes cada 100.000 mujeres
    // YEAR_DATA: un dato por año (2005-2024).
    // mama = muertes por cáncer de mama (mujeres)
    // total = muertes por cáncer total (mujeres)
    // tasa = muertes cada 100.000 mujeres
    // poblacion = población femenina estimada (INDEC)
    const YEAR_DATA = [
      { year: 2005, mama: 5364, total: 26046, tasa: 27.24, poblacion: 19693678 },
      { year: 2006, mama: 5339, total: 26197, tasa: 26.85, poblacion: 19886783 },
      { year: 2007, mama: 5395, total: 26630, tasa: 26.86, poblacion: 20082889 },
      { year: 2008, mama: 5212, total: 26442, tasa: 25.7, poblacion: 20280308 },
      { year: 2009, mama: 5419, total: 27088, tasa: 26.46, poblacion: 20477339 },
      { year: 2010, mama: 5471, total: 27373, tasa: 26.24, poblacion: 20847749 },
      { year: 2011, mama: 5422, total: 27318, tasa: 25.72, poblacion: 21080699 },
      { year: 2012, mama: 5530, total: 28192, tasa: 25.95, poblacion: 21312880 },
      { year: 2013, mama: 5660, total: 28719, tasa: 26.27, poblacion: 21543898 },
      { year: 2014, mama: 5653, total: 29168, tasa: 25.96, poblacion: 21773297 },
      { year: 2015, mama: 5970, total: 29950, tasa: 27.14, poblacion: 22000620 },
      { year: 2016, mama: 5889, total: 30102, tasa: 26.5, poblacion: 22225898 },
      { year: 2017, mama: 6049, total: 30241, tasa: 26.95, poblacion: 22449188 },
      { year: 2018, mama: 5740, total: 29118, tasa: 25.32, poblacion: 22670130 },
      { year: 2019, mama: 5900, total: 30252, tasa: 25.78, poblacion: 22888380 },
      { year: 2020, mama: 5594, total: 28886, tasa: 24.21, poblacion: 23103631 },
      { year: 2021, mama: 5820, total: 29580, tasa: 24.96, poblacion: 23315929 },
      { year: 2022, mama: 5768, total: 29351, tasa: 24.52, poblacion: 23525352 },
      { year: 2023, mama: 5840, total: 29850, tasa: 24.61, poblacion: 23731700 },
      { year: 2024, mama: 5832, total: 30006, tasa: 24.37, poblacion: 23934795 },
    ];

    // Promedio FIJO de muertes por día, 2005–2024: total de muertes / total de días
    // (cuenta los años bisiestos). Se calcula UNA vez y no cambia con el año elegido.
    const PROMEDIO_DIA = (() => {
      const bisiesto = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const muertes = YEAR_DATA.reduce((a, d) => a + d.mama, 0);
      const dias = YEAR_DATA.reduce((a, d) => a + (bisiesto(d.year) ? 366 : 365), 0);
      return muertes / dias;
    })();
    document.getElementById('brStatDia').textContent = PROMEDIO_DIA.toLocaleString('es-AR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }); // → "15,5"

    // Regresión lineal (mínimos cuadrados) de la tasa por año: la usa initYearTab()
    // para el título y la nota del eje.
    const REG = (() => {
      const n = YEAR_DATA.length;
      const mx = YEAR_DATA.reduce((s, d) => s + d.year, 0) / n;
      const my = YEAR_DATA.reduce((s, d) => s + d.tasa, 0) / n;
      let num = 0,
        den = 0;
      YEAR_DATA.forEach((d) => {
        num += (d.year - mx) * (d.tasa - my);
        den += (d.year - mx) ** 2;
      });
      const b = num / den; // pendiente (tasa por año)
      const a = my - b * mx;
      return { a, b, pred: (x) => a + b * x };
    })();

    // Número con signo explícito: +0,12 / −0,16
    const conSigno = (v) =>
      (v > 0 ? '+' : v < 0 ? '−' : '') +
      Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // yearInitDone: para que buildYearMap()/buildScatter() corran UNA
    // sola vez (la primera vez que se entra a "Por año"), no cada vez
    // que se vuelve a esa pestaña.
    let yearInitDone = false,
      scatterChart = null,
      currentYear = 2024,
      svgAnio;

    // ---------- Revelado del gráfico "Por año" ----------
    // El gráfico arranca SIN datos. Cuando el cursor (o el dedo) entra al
    // gráfico, los puntos, la línea y la tendencia se dibujan de izquierda a
    // derecha. anioProgress va de 0 a 1 durante esa animación.
    let anioRevealed = false,
      anioProgress = 0,
      anioRaf = null;

    // Animación de la cuadrícula (0 = nada, 1 = completa). Se arma cada vez
    // que se entra al capítulo o a la pestaña "Por año", ANTES de los datos.
    let anioGrid = 0,
      anioGridRaf = null,
      anioGridTimer = null;

    // buildYearMap(): dibuja el segundo mapa (el "plano", todo del
    // mismo color -- ver .br-province-plain en modulo2.css) que sirve
    // de fondo decorativo detrás del texto grande (.br-map-overlay).
    // Reutiliza el mismo DATA.provinces que el mapa interactivo de la
    // sección B, pero sin eventos de mouse ni resaltado por provincia
    // (acá no hace falta: este mapa no es clickeable).
    function buildYearMap() {
      svgAnio = document.getElementById('brMapAnio');
      svgAnio.setAttribute('viewBox', `0 0 ${DATA.width} ${DATA.height}`);
      DATA.provinces.forEach((p) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', p.d);
        path.setAttribute('class', 'br-province-plain');
        svgAnio.appendChild(path);
      });
    }

    // selectYear(year)
    // Cambia el "año elegido": actualiza el texto grande sobre el
    // mapa (.br-map-overlay) y los 2 datos sueltos de abajo
    // (.br-stat-row), y si el gráfico de dispersión ya existe, mueve
    // el punto resaltado (más grande y rosa fuerte) al año nuevo, y
    // apaga el resto (vuelven a su radio/color normal) -- "update('none')"
    // le pide a Chart.js que redibuje SIN animación, para que el
    // resaltado siga al mouse sin ningún retraso perceptible.
    function selectYear(year) {
      currentYear = year;
      const yd = YEAR_DATA.find((d) => d.year === year);

      // Columna izquierda: estos dos valores cambian con el año.
      // (El promedio por día de la columna derecha es fijo: se escribe una sola vez,
      // arriba, junto a PROMEDIO_DIA.)
      document.getElementById('brStatPob').textContent = yd.poblacion.toLocaleString('es-AR');
      document.getElementById('brStatMama').textContent = yd.mama.toLocaleString('es-AR');

      document.getElementById('brOverlayYear').textContent = year;
      document.getElementById('brOverlayPct').textContent =
        ((yd.mama / yd.total) * 100).toFixed(1).replace('.', ',') + '%';

      if (scatterChart) {
        const ds = scatterChart.data.datasets[0];
        ds.pointRadius = ds.years.map((y) => (y === year ? 8 : 4));
        ds.pointBackgroundColor = ds.years.map((y) => (y === year ? '#ff6f9c' : ds.baseColor));
        scatterChart.update('none');
      }

      // NUEVO: si este año tiene nota (2015, 2017, 2020) abre "Fuente" con ella;
      // si no, deja el botón como siempre.
      mostrarNotaAnio(year);
    }

    // revealAnio(): primera interacción con el gráfico. Oculta la pista rosa,
    // muestra los números de abajo y dibuja la serie de izquierda a derecha.
    function revealAnio() {
      if (anioRevealed || !scatterChart) return;
      anioRevealed = true;
      document
        .querySelectorAll(
          '#brPanelAnio .br-stats, #brPanelAnio .br-axis-note, #brPanelAnio .br-panel h2',
        )
        .forEach((el) => el.classList.remove('br-vacio'));
      const cont = document.getElementById('brAnioScatter').parentElement;
      cont.classList.remove('br-chart-bajo'); // el gráfico sube a su lugar (con transición en el CSS)
      const pista = document.getElementById('brAnioPrompt');
      if (pista) pista.classList.add('br-prompt-gone');
      document.getElementById('brStatDia').textContent = PROMEDIO_DIA.toLocaleString('es-AR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      selectYear(currentYear);

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        anioProgress = 1;
        scatterChart.draw();
        return;
      }
      const DURACION = 1200; // ms
      const t0 = performance.now();
      const paso = (ahora) => {
        const t = Math.min(1, (ahora - t0) / DURACION);
        anioProgress = 1 - Math.pow(1 - t, 3); // easeOutCubic
        scatterChart.draw();
        anioRaf = t < 1 ? requestAnimationFrame(paso) : null;
      };
      anioRaf = requestAnimationFrame(paso);
    }

    // ---------- Botón "i" (leyenda del gráfico "Por año") ----------
    const infoBtn = document.getElementById('brInfoBtn');
    const infoPop = document.getElementById('brInfoPop');
    function cerrarInfo() {
      if (!infoBtn || !infoPop) return;
      infoPop.hidden = true;
      infoBtn.setAttribute('aria-expanded', 'false');
    }
    if (infoBtn && infoPop) {
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // si no, el listener de document lo cerraría al instante
        const abrir = infoPop.hidden;
        infoPop.hidden = !abrir;
        infoBtn.setAttribute('aria-expanded', String(abrir));
      });
      // click afuera o Escape: cierra
      document.addEventListener('click', (e) => {
        if (!infoPop.hidden && !infoPop.contains(e.target)) cerrarInfo();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !infoPop.hidden) {
          cerrarInfo();
          infoBtn.focus();
        }
      });
    }

    // resetAnio(): vuelve al estado inicial (gráfico vacío + pista rosa visible).
    function resetAnio() {
      cerrarInfo();
      if (anioRaf) cancelAnimationFrame(anioRaf);
      anioRaf = null;
      anioRevealed = false;
      anioProgress = 0;
      ['brStatPob', 'brStatMama', 'brStatDia'].forEach((id) => {
        document.getElementById(id).textContent = '—';
      });
      // nota del eje y bloque de datos: ocultos hasta el reveal
      document
        .querySelectorAll(
          '#brPanelAnio .br-stats, #brPanelAnio .br-axis-note, #brPanelAnio .br-panel h2',
        )
        .forEach((el) => el.classList.add('br-vacio'));
      fijarDesplazamientoAnio();
      ocultarNotaAnio();
      iniciarGridAnio();
    }

    // fijarDesplazamientoAnio(): acomoda el estado VACÍO de "Por año".
    //  1) La pista rosa sube y ocupa el lugar del título "La mortalidad ... bajó casi un
    //     10%" (que está oculto hasta el reveal), así no queda un hueco arriba.
    //  2) El gráfico baja hasta quedar centrado entre la pista y el final de la tarjeta.
    // Al hacer el reveal el gráfico pierde "br-chart-bajo" y sube a su lugar solo
    // (transición en el CSS). Todo se aplica SIN transición, para que no se vea el
    // viaje cada vez que se vuelve a la pestaña. Las medidas usan offsetTop/offsetHeight
    // (ignoran transform), así que se pueden recalcular aunque ya esté desplazado.
    function fijarDesplazamientoAnio() {
      const cont = document.getElementById('brAnioScatter').parentElement;
      const titulo = document.querySelector('#brPanelAnio .br-panel h2');
      const pista = document.getElementById('brAnioPrompt');
      const nota = document.querySelector('#brPanelAnio .br-axis-note');
      const datos = document.querySelector('#brPanelAnio .br-stats');
      if (!cont || !titulo || !pista || !nota || !datos) return;

      const sube = Math.max(0, pista.offsetTop - titulo.offsetTop);
      const arriba = pista.offsetTop + pista.offsetHeight - sube; // borde inferior de la pista ya subida
      const abajo = Math.max(
        nota.offsetTop + nota.offsetHeight,
        datos.offsetTop + datos.offsetHeight,
      );
      const centrado = arriba + (abajo - arriba - cont.offsetHeight) / 2;
      const baja = Math.max(0, Math.round(centrado - cont.offsetTop));

      cont.classList.add('br-chart-wrap');
      cont.style.transition = 'none';
      cont.style.setProperty('--br-bajar', baja + 'px');
      cont.classList.add('br-chart-bajo');
      pista.style.setProperty('--br-sube', sube + 'px');
      pista.classList.add('br-prompt-sube');
      void cont.offsetWidth; // aplica el cambio sin transición
      cont.style.transition = '';
    }

    // iniciarGridAnio(): arma la cuadrícula desde cero con animación.
    // Espera un instante para que el capítulo ya esté visible y medido.
    function iniciarGridAnio() {
      clearTimeout(anioGridTimer);
      if (anioGridRaf) cancelAnimationFrame(anioGridRaf);
      anioGridRaf = null;
      anioGrid = 0;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        anioGrid = 1;
        if (scatterChart) scatterChart.update('none');
        return;
      }
      if (scatterChart) scatterChart.update('none');
      anioGridTimer = setTimeout(() => {
        if (!anioRevealed) fijarDesplazamientoAnio();
        const DURACION = 1000; // ms
        const t0 = performance.now();
        const paso = (ahora) => {
          const t = Math.min(1, (ahora - t0) / DURACION);
          anioGrid = t;
          if (scatterChart) scatterChart.update('none');
          anioGridRaf = t < 1 ? requestAnimationFrame(paso) : null;
        };
        anioGridRaf = requestAnimationFrame(paso);
      }, 150);
    }

    // buildScatter()
    // Arma el gráfico de dispersión (un punto por año, 2005-2024,
    // conectados por una línea) con la tasa de mortalidad. Se llama
    // UNA sola vez, desde initYearTab().
    function buildScatter() {
      const ctx = document.getElementById('brAnioScatter').getContext('2d');

      // Plugin hecho a mano (Chart.js no trae esto de fábrica): dibuja
      // una línea vertical punteada en la posición X del año
      // actualmente seleccionado (currentYear), para marcarlo
      // visualmente además del punto agrandado/rosa.
      const lineaVerticalPlugin = {
        id: 'lineaVertical',
        afterDatasetsDraw(chart) {
          if (anioProgress < 1) return;
          const x = chart.scales.x.getPixelForValue(currentYear);
          const { top, bottom } = chart.chartArea;
          const c = chart.ctx;
          c.save();
          c.setLineDash([4, 4]);
          c.strokeStyle = 'rgba(247,168,196,0.5)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(x, top);
          c.lineTo(x, bottom);
          c.stroke();
          c.restore();
        },
      };

      // Línea de tendencia lineal 2005-2024: punteada y muy tenue, detrás de los puntos.
      const tendenciaPlugin = {
        id: 'tendencia',
        beforeDatasetsDraw(chart) {
          const n = YEAR_DATA.length;
          const mx = YEAR_DATA.reduce((s, d) => s + d.year, 0) / n;
          const my = YEAR_DATA.reduce((s, d) => s + d.tasa, 0) / n;
          let num = 0,
            den = 0;
          YEAR_DATA.forEach((d) => {
            num += (d.year - mx) * (d.tasa - my);
            den += (d.year - mx) ** 2;
          });
          const b = num / den; // pendiente (tasa por año)
          const a = my - b * mx;
          const x0 = YEAR_DATA[0].year;
          const x1 = YEAR_DATA[n - 1].year;
          const { x, y } = chart.scales;
          const c = chart.ctx;
          c.save();
          c.setLineDash([2, 5]);
          c.lineCap = 'round';
          c.strokeStyle = 'rgba(247,168,196,0.45)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(x.getPixelForValue(x0), y.getPixelForValue(a + b * x0));
          c.lineTo(x.getPixelForValue(x1), y.getPixelForValue(a + b * x1));
          c.stroke();
          c.restore();
        },
      };
      // Zona de cada nota, dentro de la franja de abajo (izquierda del gráfico).
      //   xMax = hasta qué año llega el texto por la derecha
      //   yTop = hasta qué valor llega por arriba (el piso es siempre 24)
      // Si un año no está acá, usa la zona por defecto: hasta su propio año, hasta 25,5.
      const ZONA_NOTA = {
        2020: { xMax: 2013, yTop: 25.5 },
      };

      const notaEnGraficoPlugin = {
        id: 'notaEnGrafico',
        afterDraw(chart) {
          if (notaAnioActual === null) return;
          const texto = NOTAS_ANIO[notaAnioActual];
          if (!texto) return;
          const { chartArea, scales, ctx: c } = chart;

          const zona = ZONA_NOTA[notaAnioActual] || {
            xMax: Math.min(notaAnioActual, 2019),
            yTop: 25.5,
          };
          const margen = 8;
          const izq = chartArea.left + margen;
          const der = scales.x.getPixelForValue(zona.xMax) - margen;
          const arriba = scales.y.getPixelForValue(zona.yTop) + 6;
          const abajo = chartArea.bottom - 6;
          const maxW = der - izq;
          const maxH = abajo - arriba;
          if (maxW < 60) return;

          c.save();

          // parte el texto en renglones que entren en el ancho disponible
          const envolver = (txt, ancho) => {
            const lineas = [];
            let actual = '';
            txt.split(' ').forEach((p) => {
              const prueba = actual ? actual + ' ' + p : p;
              if (c.measureText(prueba).width > ancho && actual) {
                lineas.push(actual);
                actual = p;
              } else actual = prueba;
            });
            if (actual) lineas.push(actual);
            return lineas;
          };

          // Máximo 3 renglones: se busca el ancho MÁS ANGOSTO con el que el texto entra
          // en 3, así la nota queda pegada a la izquierda y el tooltip no la tapa.
          // Arranca en 11px y achica hasta 8px si no entra en el alto disponible.
          const MAX_LINEAS = 3;
          let size = 11,
            lineas = [],
            lineH = 0;
          for (; size >= 8; size--) {
            c.font = `italic ${size}px Inter, system-ui, sans-serif`;
            lineH = size * 1.25;
            lineas = envolver(texto, maxW);
            for (let w = 90; w < maxW; w += 6) {
              const prueba = envolver(texto, w);
              if (prueba.length <= MAX_LINEAS) {
                lineas = prueba;
                break;
              }
            }
            if (lineas.length <= MAX_LINEAS && lineas.length * lineH <= maxH) break;
          }
          c.fillStyle = 'rgba(242,233,238,0.85)';
          c.textAlign = 'left';
          c.textBaseline = 'top';
          const y0 = arriba + (maxH - lineas.length * lineH) / 2; // centrado en la zona
          lineas.forEach((l, i) => c.fillText(l, izq, y0 + i * lineH));
          c.restore();
        },
      };

      // Dibuja la cuadrícula a mano para poder animarla: las líneas horizontales
      // crecen de izquierda a derecha y las verticales de abajo hacia arriba,
      // una detrás de otra. (Chart.js la tiene desactivada: grid.display = false.)
      const cuadriculaPlugin = {
        id: 'cuadricula',
        beforeDraw(chart) {
          if (anioGrid <= 0) return;
          const { left, right, top, bottom } = chart.chartArea;
          const { x, y } = chart.scales;
          const c = chart.ctx;
          const SOLAPE = 0.55; // cuánto del tiempo se reparte escalonando las líneas
          const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
          const local = (i, n) =>
            ease((anioGrid - (i / Math.max(1, n - 1)) * SOLAPE) / (1 - SOLAPE));
          const hs = y.ticks.map((t) => Math.round(y.getPixelForValue(t.value)) + 0.5);
          const vs = x.ticks.map((t) => Math.round(x.getPixelForValue(t.value)) + 0.5);
          c.save();
          c.strokeStyle = 'rgba(255,255,255,0.06)';
          c.lineWidth = 1;
          hs.forEach((py, i) => {
            c.beginPath();
            c.moveTo(left, py);
            c.lineTo(left + (right - left) * local(i, hs.length), py);
            c.stroke();
          });
          vs.forEach((px, i) => {
            c.beginPath();
            c.moveTo(px, bottom);
            c.lineTo(px, bottom - (bottom - top) * local(i, vs.length));
            c.stroke();
          });
          c.restore();
        },
      };

      // Recorta el dibujo de la serie según anioProgress: 0 = nada, 1 = todo.
      // Va PRIMERO en la lista de plugins para que también recorte la tendencia.
      const revelarPlugin = {
        id: 'revelar',
        beforeDatasetsDraw(chart) {
          if (anioProgress >= 1) return;
          const { left, right } = chart.chartArea;
          const c = chart.ctx;
          c.save();
          c.beginPath();
          c.rect(0, 0, left - 12 + (right - left + 24) * anioProgress, chart.height);
          c.clip();
          chart._revelarActivo = true;
        },
        afterDatasetsDraw(chart) {
          if (!chart._revelarActivo) return;
          chart.ctx.restore();
          chart._revelarActivo = false;
        },
      };

      // Tooltip propio (HTML): reutiliza la clase .em-tip del módulo 1 para
      // verse igual que los demás tooltips del sitio.
      let tipEl = null;
      function tooltipExterno(context) {
        const { chart, tooltip } = context;
        if (!tipEl) {
          tipEl = document.createElement('div');
          tipEl.className = 'em-tip';
          tipEl.hidden = true;
          chart.canvas.parentElement.appendChild(tipEl);
        }
        if (!anioRevealed || tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
          tipEl.hidden = true;
          return;
        }

        const num = (v, dec) =>
          Math.abs(v).toLocaleString('es-AR', {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec,
          });
        const conSig = (v, dec) => {
          const r = Math.round(Math.abs(v) * 10 ** dec) / 10 ** dec;
          return (r === 0 ? '' : v > 0 ? '+' : '−') + num(v, dec);
        };
        const fila = (a, b) => '<div><span>' + a + '</span><span>' + b + '</span></div>';
        const tasaDe = (d) => (d.mama / d.poblacion) * 100000; // sin redondear

        const act = YEAR_DATA[tooltip.dataPoints[0].dataIndex];
        const ant = YEAR_DATA.find((d) => d.year === act.year - 1);

        let html =
          '<strong>' + act.year + '</strong>' + fila('Por 100.000 mujeres', num(tasaDe(act), 2));
        if (ant) {
          const dif = tasaDe(act) - tasaDe(ant);
          const pct = (dif / tasaDe(ant)) * 100;
          html +=
            fila('Vs. ' + ant.year, conSig(dif, 2)) + fila('Variación', conSig(pct, 1) + ' %');
        }
        tipEl.innerHTML = html;
        tipEl.hidden = false;

        // posición: centrado sobre el punto, arriba; si no entra, abajo
        const wrap = chart.canvas.parentElement;
        const w = tipEl.offsetWidth;
        const h = tipEl.offsetHeight;
        const x = Math.max(0, Math.min(wrap.clientWidth - w, tooltip.caretX - w / 2));
        let y = tooltip.caretY - h - 14;
        if (y < 0) y = tooltip.caretY + 18;
        tipEl.style.left = x + 'px';
        tipEl.style.top = y + 'px';
      }

      scatterChart = new Chart(ctx, {
        type: 'scatter',
        plugins: [
          cuadriculaPlugin,
          revelarPlugin,
          lineaVerticalPlugin,
          tendenciaPlugin,
          notaEnGraficoPlugin,
          {
            id: 'brAxisX',
            afterLayout(chart) {
              const stats = document.querySelector('.br-stats');
              if (stats) {
                stats.style.setProperty('--br-axis-x', chart.scales.y.left + 'px');
              }
            },
          },
        ],
        data: {
          datasets: [
            {
              label: 'Tasa mortalidad cáncer de mama',
              data: YEAR_DATA.map((d) => ({ x: d.year, y: d.tasa })),
              years: YEAR_DATA.map((d) => d.year),
              baseColor: '#f7a8c4',
              backgroundColor: '#f7a8c4',
              pointBackgroundColor: YEAR_DATA.map(() => '#f7a8c4'),
              pointRadius: YEAR_DATA.map(() => 4),
              pointHoverRadius: 7,
              showLine: true,
              borderColor: '#f7a8c4',
              borderWidth: 2,
              tension: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false, // la entrada la maneja revelarPlugin
          layout: { padding: { left: 10, right: 10 } },
          interaction: { mode: 'nearest', axis: 'x', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false, external: tooltipExterno },
          },
          scales: {
            x: {
              type: 'linear',
              min: 2004,
              max: 2025,
              ticks: {
                color: () => `rgba(169,154,166,${Math.max(0, (anioGrid - 0.3) / 0.7)})`, // los números de los ejes aparecen con la cuadrícula
                stepSize: 1,
                autoSkip: false,
                maxRotation: 0, // horizontales
                minRotation: 0,
                callback: (v) => ([2005, 2010, 2015, 2020, 2025].includes(v) ? v : ''),
              },
              grid: { display: false }, // la dibuja cuadriculaPlugin
            },
            y: {
              min: 24,
              max: 27.5,
              ticks: {
                color: () => `rgba(169,154,166,${Math.max(0, (anioGrid - 0.3) / 0.7)})`, // los números de los ejes aparecen con la cuadrícula
                stepSize: 0.5,
                callback: (v) => v.toLocaleString('es-AR', { minimumFractionDigits: 1 }),
              },
              grid: { display: false }, // la dibuja cuadriculaPlugin
            },
          },
          onHover: (evt, els) => {
            if (!anioRevealed) return;
            if (els.length) selectYear(YEAR_DATA[els[0].index].year);
            else ocultarNotaAnio(); // NUEVO: el cursor ya no está sobre un año
          },
        },
      });

      // Hover sobre las etiquetas de año del eje X: Chart.js detecta
      // el hover sobre los PUNTOS del gráfico solo (eso ya lo cubre
      // "onHover" de arriba), pero no sobre las etiquetas de texto
      // del eje ("2005", "2006"...). Este listener lo agrega a mano:
      // si el mouse está en la franja justo debajo del área del
      // gráfico (donde están esas etiquetas, rotadas) busca el año
      // cuya posición X esté más cerca del mouse, y si está a menos
      // de 15px lo selecciona -- así pasar el mouse por la etiqueta
      // "2010" también resalta ese año, no solo tocar el puntito.
      const canvasAnio = document.getElementById('brAnioScatter');
      canvasAnio.addEventListener('mousemove', (evt) => {
        if (!anioRevealed) return;
        const rect = canvasAnio.getBoundingClientRect();
        const mouseX = evt.clientX - rect.left,
          mouseY = evt.clientY - rect.top;
        const area = scatterChart.chartArea;
        if (mouseY > area.bottom && mouseY < area.bottom + 40) {
          const xScale = scatterChart.scales.x;
          let closestYear = null,
            closestDist = Infinity;
          YEAR_DATA.forEach((d) => {
            const dist = Math.abs(xScale.getPixelForValue(d.year) - mouseX);
            if (dist < closestDist) {
              closestDist = dist;
              closestYear = d.year;
            }
          });
          if (closestYear !== null && closestDist < 15) selectYear(closestYear);
          else ocultarNotaAnio(); // NUEVO: en la franja de etiquetas pero lejos de un año
        }
      });

      // ------------------------------------------------------------
      // PISTA ROSA "Pasá el cursor o tocá un año..." -- desaparece al interactuar
      // ------------------------------------------------------------
      // Se considera "interactuar" cuando el mouse se mueve sobre el gráfico
      // (pointermove) o cuando se lo toca en el celular (pointerdown). Se usa
      // {once:true}: cada listener se ejecuta una sola vez y se borra solo.
      // (No se usa selectYear() como disparador porque initYearTab() la llama
      // al cargar la página, y la pista desaparecería antes de que nadie
      // haya interactuado.)
      //
      // >>> SI EN ALGÚN MOMENTO QUERÉS QUE LA PISTA NO DESAPAREZCA <<<
      // Borrá (o comentá) TODO este bloque, desde "const promptAnio" hasta el
      // último "canvasAnio.addEventListener('pointerdown', ...)". Con eso la
      // pista queda fija. No hace falta tocar el HTML ni el CSS.
      const promptAnio = document.getElementById('brAnioPrompt');
      const ocultarPromptAnio = () => {
        if (promptAnio) promptAnio.classList.add('br-prompt-gone');
      };

      canvasAnio.setAttribute('tabindex', '0');
      canvasAnio.setAttribute('role', 'img');
      canvasAnio.setAttribute(
        'aria-label',
        'Gráfico de la tasa de mortalidad por cáncer de mama por año, 2005 a 2024. Con las flechas izquierda y derecha recorrés los años.',
      );
      canvasAnio.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        let i =
          YEAR_DATA.findIndex((d) => d.year === currentYear) + (e.key === 'ArrowRight' ? 1 : -1);
        i = Math.max(0, Math.min(YEAR_DATA.length - 1, i));
        selectYear(YEAR_DATA[i].year);
        const act = [{ datasetIndex: 0, index: i }];
        scatterChart.setActiveElements(act);
        scatterChart.tooltip.setActiveElements(act, { x: 0, y: 0 });
        scatterChart.update();
      });

      // NUEVO: al sacar el cursor (o el dedo) del gráfico, la nota desaparece
      canvasAnio.addEventListener('pointerleave', ocultarNotaAnio);

      // Al entrar al gráfico (mouse) o tocarlo (celular) aparecen los datos.
      canvasAnio.addEventListener('pointerenter', revealAnio);
      canvasAnio.addEventListener('pointerdown', revealAnio);
    }

    // initYearTab()
    // El "gatillo" de la carga diferida: se llama CADA VEZ que se
    // clickea la pestaña "Por año", pero "if (yearInitDone) return"
    // hace que todo lo de adentro (armar el mapa, armar el gráfico,
    // posicionar en el año actual) corra UNA sola vez, la primera.
    // Las veces siguientes, el click solo muestra lo que ya estaba
    // armado (ver el handler de tabAnio, más arriba).
    function initYearTab() {
      if (yearInitDone) return;
      yearInitDone = true;
      buildYearMap();
      buildScatter();
      selectYear(currentYear);

      // Título y nota calculados con los datos (no escritos a mano).
      const f = YEAR_DATA[0],
        l = YEAR_DATA[YEAR_DATA.length - 1];
      const pctObs = ((l.tasa - f.tasa) / f.tasa) * 100;
      const pctTen = ((REG.pred(l.year) - REG.pred(f.year)) / REG.pred(f.year)) * 100;
      const pc1 = (v) =>
        Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const tit = document.getElementById('brAnioTitulo');
      if (tit)
        tit.textContent =
          'La tasa de mortalidad por cáncer de mama bajó un ' +
          pc1(pctObs) +
          ' % entre ' +
          f.year +
          ' y ' +
          l.year;
      const nota = document.getElementById('brAxisNoteText');
      if (nota)
        nota.textContent =
          'Tasa bruta. El eje empieza en 24. La línea punteada es la tendencia lineal (mínimos cuadrados): ' +
          conSigno(REG.b) +
          ' por 100.000 mujeres por año.';
      resetAnio(); // arranca vacío hasta que el cursor entre al gráfico
      window.addEventListener('resize', () => {
        if (!anioRevealed) fijarDesplazamientoAnio();
      });
    }

    // "Por año" es la pestaña que se ve al entrar al módulo: armamos su
    // mapa y su gráfico apenas carga la página.
    initYearTab();
    srcSub.textContent = SUB_ANIO;
    setFuente(SRC_ANIO);
    // El capítulo 2 está oculto al cargar la página, así que Chart.js puede
    // haber medido el canvas en 0px: lo re-medimos cuando se hace visible.
    document.querySelector('.nav-item[data-target="2"]').addEventListener('click', () => {
      setTimeout(() => resizeChart('brAnioScatter'), 450);
    });

    // Pista rosa: reaparece cada vez que se entra de nuevo al capítulo 2.
    // Observamos la clase "active" del <section id="chapter-2"> en vez de
    // escuchar los botones, así funciona sin importar cómo se cambie de capítulo.
    const chapter2 = document.getElementById('chapter-2');
    const promptAnio = document.getElementById('brAnioPrompt');
    const promptProv = document.getElementById('brProvPrompt');
    let capituloEstabaActivo = chapter2.classList.contains('active');
    new MutationObserver(() => {
      const activo = chapter2.classList.contains('active');
      if (!activo) {
        capituloEstabaActivo = false;
        return;
      }
      if (promptAnio) promptAnio.classList.remove('br-prompt-gone');
      if (promptProv) promptProv.classList.remove('br-prompt-gone');
      if (!capituloEstabaActivo) resetAnio(); // recién entró al capítulo
      capituloEstabaActivo = true;
    }).observe(chapter2, { attributes: true, attributeFilter: ['class'] });
  })();

  // ============================================================
  // (D) [ELIMINADO] Antes había acá un "auto-escalado": la tarjeta se
  // armaba a un tamaño fijo (.br-stage) y JS la achicaba con
  // transform:scale() para que entrara justa dentro de .br-frame
  // (que tenía un alto fijo, calc(100vh - 200px)).
  //
  // Se sacó para que el módulo sea FLUIDO como el módulo 1 y el 3 (se
  // recalcula solo al ancho real de la tarjeta, no a un tamaño fijo
  // reescalado). No hizo falta tocar nada más del mapa/gráficos para
  // que esto funcione:
  //   - positionTooltip() (sección B, más arriba) ya calculaba un
  //     factor "scale = rect.width / mapCard.offsetWidth" pensado
  //     justamente para funcionar con la tarjeta escalada -- sin el
  //     escalado, ese factor da 1 solo, y la cuenta sigue siendo
  //     correcta sin cambiar una línea.
  //   - Los 2 gráficos de Chart.js (provinceChart y scatterChart) ya
  //     tienen "responsive:true" en sus opciones: se redimensionan
  //     solos al tamaño real del <canvas>, con su propio
  //     ResizeObserver interno (de la librería).
  //   - El mapa (<svg id="brMap">) ya escala solo vía su "viewBox" +
  //     el CSS "width:100%; height:auto" (ver modulo2.css).
  // Por eso alcanzó con borrar este bloque y achicar el CSS de
  // .br-frame/.br-stage/.br-widget (ver modulo2.css) -- nada de la
  // lógica del mapa, el tooltip o los gráficos se tocó.
  // ============================================================
})();
