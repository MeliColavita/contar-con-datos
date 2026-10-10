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
// (index.html) ya trae armados los botones y los textos; este script
// solo:
//   1. Crea los puntos (<div class="me-dot">) de cada grilla, UNA
//      sola vez, al cargar la página.
//   2. Les cambia la clase (apagado / encendido / nuevo) cada vez que
//      se aprieta un botón, para "pintarlos" según el modo elegido.
//   3. Actualiza los números (7,5 / 9,3 / 302 / 373 / etc.) a mano,
//      como texto, y muestra/oculta los textos que solo corresponden
//      a uno de los 2 estados (leyenda, "respuesta", pregunta,
//      instrucción, texto del botón).
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
// (dots1, pintarPanel1, etc.) visible desde afuera ni pisar nada de
// los otros módulos.
// ============================================================
(function () {
  // g1 = el contenedor de la grilla del panel 1 (ver index.html:
  // <div class="me-dotgrid" id="me-g1">). Si no existe, es que esta
  // página no tiene el módulo 3 cargado, y cortamos acá: así el
  // script nunca tira error en una página sin este módulo.
  const g1 = document.getElementById('me-g1');
  if (!g1) return; // el módulo no está en la página, no hacemos nada

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
  //      (clase "me-new" = "detectado de más con la IA").
  //   4. Actualiza el número grande (7,5 o 9,3 -- redondeado a 1
  //      decimal, pedido así por Meli; el valor exacto con intervalo
  //      de confianza sigue estando en "Fuente").
  //   5. Muestra/oculta la leyenda y la "respuesta" en rosa que SOLO
  //      corresponden a la vista "IA sola" (contenido definitivo
  //      pedido por Meli: antes estaban siempre visibles).
  function pintarPanel1(conIA) {
    dots1.forEach((d) => { d.className = 'me-dot'; });
    base1.forEach((p) => { dots1[p].className = 'me-dot me-lit'; });
    if (conIA) extra1.forEach((p) => { dots1[p].className = 'me-dot me-new'; });
    document.getElementById('me-r1').textContent = conIA ? '9,3' : '7,5';
    document.getElementById('me-leg1-ia').hidden = !conIA;
    document.getElementById('me-answer1').hidden = !conIA;
  }
  pintarPanel1(false); // estado inicial: sin IA

  // Conecta los 2 botones "Un radiólogo" / "Con apoyo de IA" del
  // panel 1. modoPanel1(conIA) hace 3 cosas a la vez: actualiza el
  // atributo aria-pressed de cada botón (para que los lectores de
  // pantalla y el estilo CSS sepan cuál está "apretado"), oculta la
  // instrucción ("Tocá 'IA sola'...") una vez que ya está activa --
  // sin esto seguía diciendo "tocá" aunque ya estuviera tocada, como
  // si no hubiese pasado nada -- y repinta la grilla llamando a
  // pintarPanel1.
  const bSin1 = document.getElementById('me-m-sin');
  const bCon1 = document.getElementById('me-m-con');
  const prompt1 = document.getElementById('me-prompt1');
  function modoPanel1(conIA) {
    bSin1.setAttribute('aria-pressed', !conIA);
    bCon1.setAttribute('aria-pressed', conIA);
    prompt1.hidden = conIA;
    pintarPanel1(conIA);
  }
  bSin1.onclick = () => modoPanel1(false);
  bCon1.onclick = () => modoPanel1(true);

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
  // se hubiera usado en la mamografía previa. Repartidas 5 por fila
  // (20 columnas x 5 filas) y salteadas dentro de cada fila -- ANTES
  // estaban casi todas concentradas en las últimas 2 filas (quedaba
  // como una barra de progreso a medio llenar, un orden que no
  // existe); ahora están esparcidas por toda la grilla, sin ningún
  // patrón visual (ni diagonal, ni agrupadas), para que se lean como
  // "25 al azar entre 100", no como una secuencia.
  const escapaban = [2, 7, 12, 15, 18, 21, 26, 30, 33, 37, 41, 45, 49, 53, 57, 62, 66, 70, 74, 78, 81, 85, 89, 93, 97];

  // pintarPanel2(conIA)
  // Repinta la grilla del panel 2: apaga todos los puntos y, si
  // conIA es true, enciende los 25 de "escapaban" en rosa (clase
  // "me-new"). El "dato grande" de este panel tiene 2 estados
  // (contenido definitivo pedido por Meli, ya no es solo un número):
  // antes de tocar el botón se ve la PREGUNTA ("me-r2-q"); después se
  // ve la RESPUESTA en rosa ("me-r2-a"), seguida de la línea opcional
  // que conecta con el título del módulo ("me-r2-note"). La leyenda
  // del punto rosa ("Marcado por la IA...") sigue el mismo criterio:
  // solo se ve una vez tocado el botón.
  function pintarPanel2(conIA) {
    dots2.forEach((d) => { d.className = 'me-dot'; });
    if (conIA) escapaban.forEach((p) => { dots2[p].className = 'me-dot me-new'; });
    document.getElementById('me-r2-q').hidden = conIA;
    document.getElementById('me-r2-a').hidden = !conIA;
    document.getElementById('me-r2-note').hidden = !conIA;
    document.getElementById('me-leg2-ia').hidden = !conIA;
  }
  pintarPanel2(false); // estado inicial: sin IA

  // Conecta el botón único "Ver qué marca la IA" del panel 2 (antes
  // eran 2 botones -- "Un radiólogo"/"Con apoyo de IA" -- pero este
  // panel no compara 2 modos de lectura como el panel 1: es una sola
  // acción de "revelar". Se deja como toggle (aria-pressed) para que
  // se pueda volver al estado inicial y repetir la interacción, en
  // vez de quedar fija una vez tocada.
  // Además de pintar la grilla, cada click actualiza el texto del
  // botón, que pasa a avisar que ahora hace lo contrario ("Volver a
  // ocultar" en vez de "Ver qué marca la IA") -- así queda claro que
  // "pasó algo" al tocarlo, aunque los puntos sean lo único que
  // cambia visualmente además de esto. (Este panel ya no tiene una
  // instrucción rosa aparte que ocultar: el botón solo ya es
  // suficientemente claro.)
  const bRev2 = document.getElementById('me-btn2');
  bRev2.onclick = () => {
    const conIA = bRev2.getAttribute('aria-pressed') !== 'true';
    bRev2.setAttribute('aria-pressed', conIA);
    bRev2.textContent = conIA ? 'Volver a ocultar' : 'Ver qué marca la IA';
    pintarPanel2(conIA);
  };
})();
