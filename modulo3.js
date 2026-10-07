// ============================================================
// MODULO3.JS — "EL FUTURO" (Capítulo 3) — Meli — prefijo: me-
// ============================================================
// QUÉ HACE ESTE ARCHIVO: pinta los puntos de las 2 grillas del
// Capítulo 3 (la de 1.000 mujeres y la de 100 cánceres de intervalo)
// según el modo elegido (con o sin apoyo de IA), y actualiza los
// números que los acompañan. Datos del estudio AIMS (Reino Unido,
// 115.973 mamografías) — Kelly et al., Nature Cancer 2026.
//
// A diferencia del módulo 1 (que dibuja gráficos de barras/waffle con
// SVG puro), acá NO HACE FALTA dibujar nada "desde cero": el HTML
// (index.html) ya trae armados los botones, el slider y los textos;
// este script solo:
//   1. Crea los puntos (<div class="me-dot">) de cada grilla, UNA
//      sola vez, al cargar la página.
//   2. Les cambia la clase (apagado / encendido / nuevo) cada vez que
//      se aprieta un botón, para "pintarlos" según el modo elegido.
//   3. Actualiza los números (7,54 / 9,33 / 302 / 373 / etc.) a mano,
//      como texto.
//
// Las grillas (me-g1, me-g2) se arman con <div> dentro de un
// contenedor CSS Grid (.me-dotgrid) -- la misma técnica que usa el
// waffle del Capítulo 1 (ver modulo1.js/css) -- en vez de dibujarlas
// con <svg>/<circle> como en una versión anterior de este archivo.
// Por eso este script ya NO necesita los helpers de SVG de script.js
// (UI.NS, UI.el): acá alcanza con document.createElement('div').
//
// Las pestañas que eligen qué grilla ver (.ui-tab/.ui-tabpanel) son
// las COMPARTIDAS del sitio y ya funcionan solas (ver el manejo
// genérico de clicks al final de script.js) -- este archivo no tiene
// que hacer nada para que cambiar de pestaña funcione.
//
// Igual que los otros módulos, todo vive adentro de una única función
// que se ejecuta sola (IIFE), para no dejar ninguna variable
// (SIN1, dots1, pintarPanel1, etc.) visible desde afuera ni pisar
// nada de los otros módulos.
// ============================================================
(function () {
  // g1 = el contenedor de la grilla del panel 1 (ver index.html:
  // <div class="me-dotgrid" id="me-g1">). Si no existe, es que esta
  // página no tiene el módulo 3 cargado, y cortamos acá: así el
  // script nunca tira error en una página sin este módulo.
  const g1 = document.getElementById('me-g1');
  if (!g1) return; // el módulo no está en la página, no hacemos nada

  // fmt(v): redondea "v" al entero más cercano y lo formatea con
  // puntos de miles, estilo argentino: 1234567 -> "1.234.567".
  const fmt = (v) => Math.round(v).toLocaleString('es-AR');

  // crearPuntos(container, count)
  // Crea "count" elementos <div class="me-dot"> (todos arrancan
  // "apagados", sin ninguna clase extra) dentro de "container", y
  // devuelve un array con la referencia a cada uno -- así después se
  // puede ir a buscar, por ejemplo, "dots1[37]" para cambiarle la
  // clase y "encenderlo", sin tener que recorrer el DOM de nuevo cada
  // vez.
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

  // ============================================================
  // PANEL 1: grilla de 1.000 mujeres (tasas del estudio AIMS)
  // ============================================================
  // SIN1 = tasa de detección de un radiólogo solo: 7,54 cánceres
  //        detectados cada 1.000 mujeres.
  // CON1 = tasa de detección CON apoyo de IA: 9,33 cada 1.000.
  // Fuente de los 2 números: Kelly C.J., Wilson M. et al., Nature
  // Cancer 2026 (el detalle completo está en el <details class=
  // "ui-src"> del HTML, abajo de este panel).
  const SIN1 = 7.54, CON1 = 9.33;

  // Crea los 1.000 puntos (40 columnas x 25 filas, definido en el
  // "style" inline del HTML: grid-template-columns:repeat(40,1fr)) y
  // guarda la referencia de cada uno en "dots1".
  const dots1 = crearPuntos(g1, 1000);

  // base1: 8 posiciones FIJAS (no al azar -- elegidas a mano para que
  // se vean repartidas por toda la grilla) que representan lo que
  // encuentra un radiólogo solo (8 de 1.000 ≈ 7,54 por mil,
  // redondeado al entero más cercano que entra en la grilla).
  // extra1: 2 posiciones FIJAS más, que se suman SOLO cuando está
  // activado el modo "Con apoyo de IA" -- entre las 8 de base1 + estas
  // 2 se completa el ≈9,33 por mil de la tasa con IA.
  // Son posiciones fijas (no generadas al azar en cada carga de
  // página) para que el dibujo sea siempre el mismo, reproducible.
  const base1 = [37, 152, 268, 391, 468, 591, 743, 880];
  const extra1 = [88, 655];

  // pintarPanel1(conIA)
  // Repinta la grilla completa del panel 1 desde cero cada vez que se
  // cambia de modo:
  //   1. Apaga TODOS los puntos (vuelve cada uno a la clase base
  //      "me-dot", sin "me-lit" ni "me-new").
  //   2. Enciende los 8 de "base1" en ámbar (clase "me-lit" = "cáncer
  //      detectado", el hallazgo de un radiólogo solo).
  //   3. Si conIA es true, enciende ADEMÁS los 2 de "extra1" en rosa
  //      (clase "me-new" = "diferencia atribuible a la IA").
  //   4. Actualiza el número grande (7,54 o 9,33) junto a la grilla.
  function pintarPanel1(conIA) {
    dots1.forEach((d) => { d.className = 'me-dot'; });
    base1.forEach((p) => { dots1[p].className = 'me-dot me-lit'; });
    if (conIA) extra1.forEach((p) => { dots1[p].className = 'me-dot me-new'; });
    document.getElementById('me-r1').textContent = conIA ? '9,33' : '7,54';
  }
  pintarPanel1(false); // estado inicial: sin IA

  // Conecta los 2 botones "Un radiólogo" / "Con apoyo de IA" del
  // panel 1. modoPanel1(conIA) hace 2 cosas a la vez: actualiza el
  // atributo aria-pressed de cada botón (para que los lectores de
  // pantalla y el estilo CSS sepan cuál está "apretado") y repinta la
  // grilla llamando a pintarPanel1.
  const bSin1 = document.getElementById('me-m-sin');
  const bCon1 = document.getElementById('me-m-con');
  function modoPanel1(conIA) {
    bSin1.setAttribute('aria-pressed', !conIA);
    bCon1.setAttribute('aria-pressed', conIA);
    pintarPanel1(conIA);
  }
  bSin1.onclick = () => modoPanel1(false);
  bCon1.onclick = () => modoPanel1(true);

  // ============================================================
  // SLIDER DE PROYECCIÓN ("Proyección sobre esta tasa")
  // ============================================================
  // El slider deja "escalar" las tasas SIN1/CON1 a una cantidad de
  // mujeres mayor a las 115.973 del estudio real -- por eso el
  // <details class="ui-src"> del HTML aclara que esto es una
  // EXTRAPOLACIÓN lineal, no un resultado medido directamente por el
  // estudio.
  const n = document.getElementById('me-n'); // el <input type="range">

  // upd()
  // Lee el valor actual del slider (n.value, un string -- el "+"
  // adelante lo convierte a número) y recalcula los 3 resultados:
  //   a = cuántos detectaría un radiólogo solo, sobre "v" mujeres
  //   b = cuántos detectaría con apoyo de IA, sobre "v" mujeres
  //   (b - a) = la diferencia atribuible a la IA
  // Los 3 se redondean al entero más cercano y se escriben como texto
  // en sus respectivos <div> (me-s-sin, me-s-con, me-s-dif), junto
  // con la etiqueta del slider (me-nlab) que muestra la cantidad de
  // mujeres elegida.
  function upd() {
    const v = +n.value;
    const a = Math.round((v * SIN1) / 1000);
    const b = Math.round((v * CON1) / 1000);
    document.getElementById('me-nlab').textContent = fmt(v);
    document.getElementById('me-s-sin').textContent = fmt(a);
    document.getElementById('me-s-con').textContent = fmt(b);
    document.getElementById('me-s-dif').textContent = '+' + fmt(b - a);
  }
  // oninput se dispara en cada movimiento del slider (no solo al
  // soltarlo), así los números se actualizan en vivo mientras se
  // arrastra.
  n.oninput = upd;
  upd(); // pinta los valores iniciales (40.000 mujeres, el value por defecto del HTML) apenas carga

  // ============================================================
  // PANEL 2: 100 cánceres de intervalo
  // ============================================================
  // Un "cáncer de intervalo" es el que aparece ENTRE dos controles de
  // rutina, porque no se vio en la mamografía anterior (es decir: ya
  // estaba, pero no fue detectado a tiempo). La IA identificó
  // retrospectivamente el 25% de esos cánceres en esa mamografía
  // previa -- por eso acá NO hay una "tasa" que proyectar como en el
  // panel 1: es directamente "25 de cada 100 puntos se encienden"
  // cuando está activado el modo con IA.
  const g2 = document.getElementById('me-g2');
  // Crea los 100 puntos (20 columnas x 5 filas, definido en el HTML).
  const dots2 = crearPuntos(g2, 100);

  // escapaban: las 25 posiciones FIJAS (25% de 100) que representan
  // los cánceres de intervalo que la IA habría identificado antes, si
  // se hubiera usado en la mamografía previa.
  const escapaban = [3, 11, 19, 27, 34, 42, 48, 55, 61, 66, 70, 73, 77, 80, 82, 85, 87, 89, 91, 92, 94, 95, 96, 97, 98];

  // pintarPanel2(conIA)
  // Repinta la grilla del panel 2: apaga todos los puntos y, si
  // conIA es true, enciende los 25 de "escapaban" en rosa (clase
  // "me-new"). Actualiza el número grande (0 o 25) y le agrega/saca
  // la clase compartida .ui-pinktext (el mismo rosa que usa
  // .ui-pinktext en el resto del sitio) para que el número se vea en
  // color solo cuando hay algo que mostrar.
  function pintarPanel2(conIA) {
    dots2.forEach((d) => { d.className = 'me-dot'; });
    if (conIA) escapaban.forEach((p) => { dots2[p].className = 'me-dot me-new'; });
    const num = document.getElementById('me-r2');
    num.textContent = conIA ? '25' : '0';
    num.classList.toggle('ui-pinktext', conIA);
  }
  pintarPanel2(false); // estado inicial: sin IA

  // Conecta los 2 botones "Un radiólogo" / "Con apoyo de IA" del
  // panel 2 (son botones DISTINTOS a los del panel 1 -- ids con el
  // "2" al final -- porque cada panel tiene su propio control
  // independiente; cambiar el modo en un panel no afecta al otro).
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
