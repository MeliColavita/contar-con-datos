// ============================================================
// SCRIPT.JS — ARCHIVO GENERAL (compartido). Cada módulo tiene su JS:
// modulo1.js (Emi), modulo2.js (Brenda), modulo3.js (Meli).
// Lógica de: intro, audio, navegación entre capítulos
// y reinicio de la animación de los puntitos al cambiar de módulo
// ============================================================

// ---------- Referencias a elementos del DOM ----------
const intro = document.getElementById('intro');
const introVideo = document.getElementById('introVideo');
const audio = document.getElementById('bgAudio');
const audioBtn = document.getElementById('audioBtn');
let audioHasEnded = false; // se pone en true cuando termina el audio; a partir de ahí el audioBtn cambia de rol (ver más abajo)
const navItems = document.querySelectorAll('.nav-item');
const chapters = document.querySelectorAll('.chapter');
const chapterVideos = document.querySelectorAll('.chapter-video'); // los 3 videos de la columna de velas

// Los 3 <video> tienen "autoplay", así que sin esto los 3 arrancan
// a reproducirse apenas carga la página. Pausamos LOS TRES (incluido
// el del capítulo 1, que es el que queda .active de entrada) y los
// dejamos en el frame 0: ninguno arranca hasta que el usuario entre
// a ese módulo específico (ver más abajo el click de audioBtn para el
// capítulo 1, y el click de navItems para los capítulos 2 y 3).
chapterVideos.forEach((v) => {
  v.pause();
  v.currentTime = 0;
});

// ---------- Intro: el video aparece cuando el audio llega al segundo 22 ----------
const INTRO_VIDEO_START = 22; // segundo del audio en el que entra el video
let introVideoStarted = false;

function startIntroVideo() {
  if (introVideoStarted) return; // que arranque una sola vez
  if (intro.classList.contains('hidden')) return; // si ya saltó la intro, no lo arrancamos
  introVideoStarted = true;
  introVideo.currentTime = 0;
  introVideo.play().catch((err) => console.warn('No se pudo reproducir el video de intro:', err));
  introVideo.classList.add('visible');
}

// Devuelve el video a su estado inicial: oculto, quieto en el frame 0 y listo
// para dispararse de nuevo a los 22 s. Pasa cuando el audio se reinicia o se
// lleva hacia atrás (antes del segundo 22).
function resetIntroVideo() {
  introVideoStarted = false;
  introVideo.classList.remove('visible'); // se desvanece (el fade dura 1,6 s)
  setTimeout(() => {
    if (introVideoStarted) return; // si ya se volvió a disparar, no tocarlo
    introVideo.pause();
    introVideo.currentTime = 0;
  }, 1700);
}

// 'timeupdate' se dispara varias veces por segundo mientras suena el audio
audio.addEventListener('timeupdate', () => {
  if (audio.currentTime >= INTRO_VIDEO_START) startIntroVideo();
  else if (introVideoStarted) resetIntroVideo(); // el audio volvió antes del seg. 22
});

// ---------- Audio + botón con doble rol ----------
// El mismo botón (#audioBtn) cumple dos roles, uno después del otro:
//   1) Mientras el audio no terminó: activa/pausa el audio (como antes).
//   2) Apenas el audio termina (evento 'ended', más abajo): pasa a decir
//      "Tocá para comenzar ↓" y, a partir de ahí, un click más oculta el
//      intro (#intro.hidden) y entra a la experiencia. audioHasEnded es
//      lo que distingue en qué rol está el botón en cada click.
// e.stopPropagation() evita que el click se propague y dispare, sin
// querer, algún handler del contenedor padre.
// Entra a la experiencia (lo usa el botón del audio ya terminado).
function enterExperience() {
  clearInterval(fadeId); // corta el fade-in de volumen si seguía en curso
  audio.pause();
  audio.currentTime = 0;
  introVideo.pause();
  // Importante: sacar "started"/"ended". Con "started", el CSS deja
  // .player-controls en visibility:visible y los .pbtn tienen
  // pointer-events:auto, así que seguían recibiendo clicks por encima de
  // los módulos aunque #intro estuviera .hidden.
  intro.classList.remove('started', 'ended', 'failed');
  intro.classList.add('hidden');
  intro.setAttribute('inert', ''); // nada del intro recibe clicks ni foco
  intro.setAttribute('aria-hidden', 'true');
  introCaption.hidden = true;

  // Recién ahora arranca el video del módulo activo (capítulo 1 al
  // entrar por primera vez). Los capítulos 2 y 3 arrancan solos al
  // navegar a ellos (ver handler de navItems más abajo).
  const activeVideo = document.querySelector('.chapter-video.active');
  if (activeVideo) {
    activeVideo.currentTime = 0;
    activeVideo
      .play()
      .catch((err) => console.warn('No se pudo reproducir el video del capítulo activo:', err));
  }
}

const AUDIO_FAIL_TEXT = 'Continuar →';
// true cuando ya se entró a la experiencia (la intro quedó desactivada)
function introClosed() {
  return intro.classList.contains('hidden');
}
// Si el audio no carga, no dejamos la intro trabada: se puede entrar igual.
function audioFailed() {
  if (introClosed()) return; // si ya se salteó la intro, no la "revivimos"
  audioHasEnded = true;
  audioBtn.textContent = AUDIO_FAIL_TEXT;
  intro.classList.remove('started');
  intro.classList.add('ended', 'failed'); // vuelve a mostrar el botón para poder entrar igual
}
audio.addEventListener('error', audioFailed);
const audioSrc = audio.querySelector('source');
if (audioSrc) audioSrc.addEventListener('error', audioFailed);

// Botón "Saltear intro" (abajo a la derecha): entra directo a la experiencia
// sin esperar a que termine el audio.
const skipBtn = document.getElementById('skipBtn');
skipBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  enterExperience();
});

// Botón central "Apretá acá para comenzar": arranca el audio y, si salió
// bien, se convierte en la barra de reproducción (clase "started" en
// #intro; el CSS hace la transformación). Cuando el audio termina, vuelve
// a ser un botón: "Continuar →", con un botón al lado para volver a escuchar.
audioBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (introClosed()) return;

  if (audioHasEnded) {
    enterExperience();
    return;
  }

  audio.volume = 0;
  intro.classList.add('started'); // la barra responde al toque al instante, sin esperar a que cargue el audio
  audio
    .play()
    .then(() => {
      if (introClosed()) return audio.pause(); // se salteó mientras cargaba
      fadeVolume(0.45); // sube el volumen gradualmente hasta 0.45
    })
    .catch((err) => {
      // Si se saltea la intro mientras play() está pendiente, pause()
      // rechaza la promesa: no es un error real, no hay que hacer nada.
      if (introClosed()) return;
      console.warn('No se pudo reproducir el audio:', err);
      audioFailed();
    });
});

// ---------- Barra de reproducción de la intro ----------
// SUBTÍTULOS del audio (AUDIO_FINAL.mp3). start/end = segundos del audio
// en los que se muestra cada frase. Si la lista queda vacía, el botón CC
// se oculta solo.

const CAPTIONS = [
  { start: 2.14, end: 4.0, text: 'Hola, doctor.' },
  { start: 5.2, end: 6.0, text: 'Hola, Mariana.' },
  { start: 6.1, end: 7.5, text: 'Tomá asiento.' },
  { start: 8.2, end: 12.3, text: 'Bueno, Mari, llegaron los resultados de la biopsia.' },
  { start: 12.25, end: 15.2, text: 'En la muestra que tomamos de la mama,' },
  { start: 15.1, end: 18.05, text: 'aparecieron células anormales.' },
  { start: 18.3, end: 20.12, text: '¿Tengo cáncer?' },
  { start: 20.5, end: 22.0, text: 'Sí.' },
  { start: 23.5, end: 25.28, text: 'Sé que es muy difícil escuchar esto,' },
  { start: 26.3, end: 29.9, text: 'pero lo encontramos a tiempo y tiene tratamiento.' },
];

const pFill = document.getElementById('pFill');
const pTrack = document.getElementById('pTrack');
const pTime = document.getElementById('pTime');
const pPlay = document.getElementById('pPlay');
const pRestart = document.getElementById('pRestart');
const pMute = document.getElementById('pMute');
const pCC = document.getElementById('pCC');
const introCaption = document.getElementById('introCaption');
let captionsOn = true; // los subtítulos arrancan activados: con CC se pueden apagar
if (CAPTIONS.length === 0) pCC.hidden = true;

function fmtTime(s) {
  if (!isFinite(s)) s = 0;
  return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}

function updateCaption(t) {
  const cue =
    captionsOn && !audio.ended && !intro.classList.contains('ended')
      ? CAPTIONS.find((c) => t >= c.start && t < c.end)
      : null;
  if (cue) {
    if (introCaption.textContent !== cue.text) introCaption.textContent = cue.text;
    introCaption.hidden = false;
  } else {
    introCaption.hidden = true;
  }
}

// Avance (relleno de la barra), tiempo "0:12 / 1:05" y subtítulo actual
function updatePlayer() {
  const d = audio.duration || 0;
  const t = audio.currentTime || 0;
  pFill.style.width = (d ? (t / d) * 100 : 0) + '%';
  pTime.textContent = fmtTime(t) + ' / ' + fmtTime(d);
  updateCaption(t);
}
['timeupdate', 'loadedmetadata', 'durationchange', 'seeked'].forEach((ev) =>
  audio.addEventListener(ev, updatePlayer),
);

function updatePlayState() {
  pPlay.dataset.state = audio.paused ? 'paused' : 'playing';
  pPlay.setAttribute('aria-label', audio.paused ? 'Reproducir' : 'Pausar');
}
audio.addEventListener('play', updatePlayState);
audio.addEventListener('pause', updatePlayState);

pPlay.addEventListener('click', () => {
  if (introClosed()) return;
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
});
pRestart.addEventListener('click', () => {
  if (introClosed()) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
});
pMute.addEventListener('click', () => {
  if (introClosed()) return;
  audio.muted = !audio.muted;
  pMute.dataset.state = audio.muted ? 'muted' : 'on';
  pMute.setAttribute('aria-label', audio.muted ? 'Activar sonido' : 'Silenciar');
});
pCC.addEventListener('click', () => {
  if (introClosed()) return;
  captionsOn = !captionsOn;
  pCC.setAttribute('aria-pressed', captionsOn);
  updateCaption(audio.currentTime);
});
// "Volver a escuchar" (solo se ve con el audio terminado): reinicia el audio
// y la barra de reproducción vuelve a aparecer, junto con "Saltear intro".
const pReplay = document.getElementById('pReplay');
pReplay.addEventListener('click', () => {
  if (introClosed()) return;
  audioHasEnded = false;
  intro.classList.remove('ended');
  intro.classList.add('started');
  audio.currentTime = 0;
  audio.play().catch((err) => {
    console.warn('No se pudo reproducir el audio:', err);
    audioFailed();
  });
});
// Tocar la barra lleva el audio a ese momento (solo con la barra activa)
pTrack.addEventListener('click', (e) => {
  if (introClosed() || !intro.classList.contains('started') || !audio.duration) return;
  const r = pTrack.getBoundingClientRect();
  audio.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * audio.duration;
});

// Cuando el audio termina (el <audio> NO tiene "loop", así que este evento
// sí se dispara): el botón cambia de texto y, desde acá en adelante, el
// click de arriba lo trata como "entrar a la experiencia" en vez de
// activar/pausar audio.
audio.addEventListener('ended', () => {
  if (introClosed()) return;
  audioHasEnded = true;
  audioBtn.textContent = AUDIO_FAIL_TEXT; // "Continuar →"
  intro.classList.remove('started');
  intro.classList.add('ended'); // la barra vuelve a ser el botón "Continuar" (+ volver a escuchar)
  introCaption.hidden = true;
});

// Sube el volumen del audio de a poco (en "steps" pasos) para que no entre
// de golpe apenas se aprieta play. target = volumen final (0 a 1).
let fadeId = null; // guardamos el intervalo para poder cortarlo al saltear la intro
function fadeVolume(target, ms = 1500) {
  clearInterval(fadeId);
  const steps = 30;
  const stepSize = target / steps;
  let i = 0;
  fadeId = setInterval(() => {
    i++;
    audio.volume = Math.min(target, stepSize * i);
    if (i >= steps) clearInterval(fadeId);
  }, ms / steps);
}

// ---------- Chapter navigation ----------
// navItems: los 3 botones del menú lateral
// chapters: las 3 secciones .chapter (cada una con su video de fondo y título)
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const actual = document.querySelector('.chapter.active');
    const fuentesQueSalen = actual ? actual.querySelectorAll('.ui-src') : [];
    uiFuenteSalir(fuentesQueSalen, () => {
      // Desactiva todos los nav-items, todos los capítulos y todos los videos...
      navItems.forEach((n) => n.classList.remove('active'));
      chapters.forEach((c) => c.classList.remove('active'));
      chapterVideos.forEach((v) => v.classList.remove('active'));

      // ...y activa solo el nav-item clickeado, el capítulo correspondiente,
      // y el video de esa misma vela, usando data-target (1, 2 o 3) para
      // armar el id "chapter-X" (capítulo) y para matchear data-chapter (video)
      item.classList.add('active');
      const target = item.dataset.target;
      const chapter = document.getElementById('chapter-' + target);
      chapter.classList.add('active');

      const video = document.querySelector('.chapter-video[data-chapter="' + target + '"]');
      if (video) {
        video.classList.add('active');
        video.currentTime = 0; // reinicia el video al frame 0 cada vez que se muestra
        video
          .play()
          .catch((err) => console.warn('No se pudo reproducir el video del capítulo:', err)); // arranca recién ahora, al entrar al módulo
      }

      // Pausa los videos que quedaron ocultos (ahorra CPU/batería;
      // sin esto, los 3 videos quedan reproduciéndose todo el tiempo aunque
      // no se vean, que es justo lo que hacía que no arrancaran de cero).
      chapterVideos.forEach((v) => {
        if (v !== video) v.pause();
      });

      // Reinicia la animación de los puntitos rosa alrededor del título.
      // Sin este truco, la animación CSS (dotPop) solo correría la primera vez:
      // al volver a agregar la clase .active, el navegador no la "re-dispara"
      // porque, para el motor de CSS, la animación ya había corrido antes.
      const dots = chapter.querySelectorAll('.dot');
      dots.forEach((dot) => {
        dot.style.animation = 'none'; // saca la animación
        void dot.offsetWidth; // fuerza un reflow (lee una propiedad de layout)
        dot.style.animation = ''; // se la devuelve: ahora arranca desde cero
      });
    });
  });
});

// ============================================================
// HELPERS Y COMPONENTES COMPARTIDOS (los usan todos los módulos)
// ============================================================
// UI.NS: namespace SVG. UI.el(tag, attrs): crea un elemento SVG.
// UI.rng(seed): números "aleatorios" reproducibles. UI.fmt(n): 1234 -> "1.234".
const UI = {
  NS: 'http://www.w3.org/2000/svg',
  rng: function (seed) {
    return function () {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  },
  el: function (t, a) {
    let e = document.createElementNS(UI.NS, t);
    for (let k in a) e.setAttribute(k, a[k]);
    return e;
  },
  fmt: function (v) {
    return Math.round(v).toLocaleString('es-AR');
  },
};

// Pestañas (.ui-tab / .ui-tabpanel): funcionan solas en cualquier módulo.
// Cada botón tiene aria-controls="id-del-panel"; solo afecta a las pestañas
// de su propio .ui-wrap, así los módulos no se pisan entre sí.
document.querySelectorAll('.ui-tab').forEach(function (btn) {
  btn.addEventListener('click', function () {
    let wrap = btn.closest('.ui-wrap');
    wrap.querySelectorAll('.ui-tab').forEach(function (b) {
      b.setAttribute('aria-selected', 'false');
    });
    wrap.querySelectorAll('.ui-tabpanel').forEach(function (p) {
      p.classList.remove('active');
    });
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(btn.getAttribute('aria-controls')).classList.add('active');
  });
});

// ---------- Volver a la presentación ----------
// Mismo criterio que "Volver a comenzar" del módulo 3: recargar la página
// deja la intro, el audio y los videos como al inicio.
const navBack = document.getElementById('navBack');
if (navBack) navBack.addEventListener('click', () => location.reload());

// ---------- Fuente con links (compartido) ---------- la usan los tres modulos
//   fuentes: [{ autor, etiqueta, url }]
function uiFuente(details, fuentes, nota) {
  const p = details.querySelector('p');
  p.textContent = '';
  fuentes.forEach(function (f) {
    const linea = document.createElement('span');
    linea.className = 'ui-src-item';
    linea.append(f.autor + '. ');
    const a = document.createElement('a');
    a.href = f.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = f.etiqueta;
    linea.appendChild(a);
    p.appendChild(linea);
  });
  if (nota) {
    const n = document.createElement('span');
    n.className = 'ui-src-nota';
    n.textContent = nota;
    p.appendChild(n);
  }
  details.removeAttribute('open'); // al cambiar de pestaña se cierra
}

// ---------- Salida de la Fuente (compartido) ---------- la usan los tres modulos
// Hace desaparecer una o varias etiquetas "Fuente" (un elemento o una lista)
// y, cuando termina, ejecuta alAcabar (cambiar de pestaña, de módulo...).
// Con "reducir movimiento" ejecuta alAcabar directo, sin esperar.
function uiFuenteSalir(fuentes, alAcabar) {
  const lista = fuentes && fuentes.nodeType ? [fuentes] : Array.from(fuentes || []);
  // Si el desplegable estaba abierto, se cierra enseguida (también con teclado).
  lista.forEach(function (f) {
    f.removeAttribute('open');
  });
  if (!lista.length || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (alAcabar) alAcabar();
    return;
  }
  lista.forEach(function (f) {
    f.classList.add('ui-src-out');
  });
  setTimeout(function () {
    if (alAcabar) alAcabar();
    lista.forEach(function (f) {
      f.classList.remove('ui-src-out');
    });
  }, 350);
}

// ---------- "Fuente" abierta: se cierra al tocar otra cosa (compartido) ----------
// Si el desplegable está abierto y el usuario toca cualquier otro lugar (otra
// pestaña, el gráfico, el mapa, el menú de módulos...) o aprieta Escape, se cierra.
// Tocar la propia etiqueta o el texto abierto no lo cierra.
document.addEventListener('pointerdown', function (e) {
  document.querySelectorAll('.ui-src[open]').forEach(function (d) {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.ui-src[open]').forEach(function (d) {
    d.removeAttribute('open');
  });
});
