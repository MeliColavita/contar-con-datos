// ============================================================
// MODULO3.JS — "EL FUTURO" (capítulo 3) — Meli — prefijo: me-
// Datos del estudio AIMS (Reino Unido, 115.973 mamografías) — Kelly
// et al., Nature Cancer 2026. Reemplaza la versión anterior, que
// usaba MASAI/McKinney.
//
// Las grillas de puntos (me-g1, me-g2) ya NO se arman con <svg>: son
// <div class="me-dot"> dentro de un contenedor CSS Grid (.me-dotgrid),
// la misma técnica que ya usa el waffle del Capítulo 1 — así los dos
// capítulos comparten un solo enfoque para "grilla que se pinta según
// datos", y este archivo ya no necesita los helpers de SVG de
// script.js (UI.NS, UI.el). Sigue en su propia IIFE con ids me-* para
// no chocar con nada del resto del sitio. Las pestañas
// (.ui-tab/.ui-tabpanel) ya funcionan solas (ver script.js).
// ============================================================
(function () {
  const g1 = document.getElementById('me-g1');
  if (!g1) return; // el módulo no está en la página, no hacemos nada

  const fmt = (v) => Math.round(v).toLocaleString('es-AR'); // 1234567 -> "1.234.567"

  // Crea "count" <div class="me-dot"> dentro de "container" y devuelve
  // el array de referencias, para después pintarlas una por una.
  function crearPuntos(container, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const d = document.createElement('div');
      d.className = 'me-dot';
      container.appendChild(d);
      out.push(d);
    }
    return out;
  }

  // ---------- Panel 1: grilla de 1.000 mujeres (tasas AIMS) ----------
  // SIN = tasa de detección de un radiólogo solo (7,54 cada 1.000).
  // CON = tasa con apoyo de IA (9,33 cada 1.000). Fuente: Kelly et al.,
  // Nature Cancer 2026 (ver <details class="ui-src"> en el HTML).
  const SIN1 = 7.54, CON1 = 9.33;
  const dots1 = crearPuntos(g1, 1000);

  // 8 posiciones "base" (lo que encuentra un radiólogo, ~7,54 por mil
  // redondeado) + 2 posiciones "extra" que se suman solo con IA
  // activada (hasta completar ~9,33 por mil). Son posiciones fijas (no
  // al azar en cada carga de página), elegidas para que se vean
  // repartidas en la grilla.
  const base1 = [37, 152, 268, 391, 468, 591, 743, 880];
  const extra1 = [88, 655];

  function pintarPanel1(conIA) {
    dots1.forEach((d) => { d.className = 'me-dot'; });
    base1.forEach((p) => { dots1[p].className = 'me-dot me-lit'; });
    if (conIA) extra1.forEach((p) => { dots1[p].className = 'me-dot me-new'; });
    document.getElementById('me-r1').textContent = conIA ? '9,33' : '7,54';
  }
  pintarPanel1(false);

  const bSin1 = document.getElementById('me-m-sin');
  const bCon1 = document.getElementById('me-m-con');
  function modoPanel1(conIA) {
    bSin1.setAttribute('aria-pressed', !conIA);
    bCon1.setAttribute('aria-pressed', conIA);
    pintarPanel1(conIA);
  }
  bSin1.onclick = () => modoPanel1(false);
  bCon1.onclick = () => modoPanel1(true);

  // ---------- Slider de proyección ("Llevalo a más mujeres") ----------
  // Proyección LINEAL de las tasas SIN1/CON1 sobre una cantidad de
  // mujeres mayor a las 115.973 del estudio real — por eso la nota del
  // <details class="ui-src"> aclara que es una extrapolación, no un
  // resultado del estudio.
  const n = document.getElementById('me-n');
  function upd() {
    const v = +n.value;
    const a = Math.round((v * SIN1) / 1000);
    const b = Math.round((v * CON1) / 1000);
    document.getElementById('me-nlab').textContent = fmt(v);
    document.getElementById('me-s-sin').textContent = fmt(a);
    document.getElementById('me-s-con').textContent = fmt(b);
    document.getElementById('me-s-dif').textContent = '+' + fmt(b - a);
  }
  n.oninput = upd;
  upd(); // pinta los valores iniciales (40.000 mujeres) apenas carga

  // ---------- Panel 2: 100 cánceres de intervalo ----------
  // Un cáncer de intervalo es el que aparece entre dos controles
  // porque no se vio en la mamografía anterior. La IA identificó el
  // 25% de esos cánceres ya presentes (aunque no detectados) en esa
  // mamografía previa — por eso acá no hay "tasa", es directamente
  // "25 de cada 100 puntos se encienden".
  const g2 = document.getElementById('me-g2');
  const dots2 = crearPuntos(g2, 100);

  // 25 posiciones fijas = el 25% que la IA habría identificado antes.
  const escapaban = [3, 11, 19, 27, 34, 42, 48, 55, 61, 66, 70, 73, 77, 80, 82, 85, 87, 89, 91, 92, 94, 95, 96, 97, 98];

  function pintarPanel2(conIA) {
    dots2.forEach((d) => { d.className = 'me-dot'; });
    if (conIA) escapaban.forEach((p) => { dots2[p].className = 'me-dot me-new'; });
    const num = document.getElementById('me-r2');
    num.textContent = conIA ? '25' : '0';
    num.classList.toggle('ui-pinktext', conIA);
  }
  pintarPanel2(false);

  const bSin2 = document.getElementById('me-m-sin2');
  const bCon2 = document.getElementById('me-m-con2');
  bSin2.onclick = () => {
    bSin2.setAttribute('aria-pressed', 'true');
    bCon2.setAttribute('aria-pressed', 'false');
    pintarPanel2(false);
  };
  bCon2.onclick = () => {
    bSin2.setAttribute('aria-pressed', 'false');
    bCon2.setAttribute('aria-pressed', 'true');
    pintarPanel2(true);
  };
})();
