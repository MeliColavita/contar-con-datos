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

// ---------- Intro: el video aparece a los 10 segundos, desde el inicio ----------
// Como #introVideo ya no tiene "autoplay" (ver HTML), no se reprodujo
// nada todavía: a los 10s lo mandamos al frame 0 por las dudas y recién
// ahí lo arrancamos (play) al mismo tiempo que el fade-in (.visible).
setTimeout(() => {
  if (intro.classList.contains('hidden')) return; // si ya saltó la intro, no arrancamos el video
  introVideo.currentTime = 0;
  introVideo.play().catch((err) => console.warn('No se pudo reproducir el video de intro:', err));
  introVideo.classList.add('visible');
}, 10000);

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
  audio.pause();
  introVideo.pause();
  intro.classList.add('hidden');

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

const AUDIO_FAIL_TEXT = 'Tocá para comenzar ↓';
// Si el audio no carga, no dejamos la intro trabada: se puede entrar igual.
function audioFailed() {
  audioHasEnded = true;
  audioBtn.textContent = AUDIO_FAIL_TEXT;
}
audio.addEventListener('error', audioFailed);
const audioSrc = audio.querySelector('source');
if (audioSrc) audioSrc.addEventListener('error', audioFailed);

audioBtn.addEventListener('click', (e) => {
  e.stopPropagation();

  if (audioHasEnded) {
    enterExperience();
    return;
  }

  if (audio.paused) {
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        fadeVolume(0.45); // sube el volumen gradualmente hasta 0.45
        audioBtn.textContent = '🔊 Silenciar ⏸';
      })
      .catch((err) => {
        console.warn('No se pudo reproducir el audio:', err);
        audioFailed();
      });
  } else {
    audio.pause();
    audioBtn.textContent = '🔇 Activar audio ▶';
  }
});

// Cuando el audio termina (el <audio> NO tiene "loop", así que este evento
// sí se dispara): el botón cambia de texto y, desde acá en adelante, el
// click de arriba lo trata como "entrar a la experiencia" en vez de
// activar/pausar audio.
audio.addEventListener('ended', () => {
  audioHasEnded = true;
  audioBtn.textContent = 'Tocá para comenzar ↓';
});

// Sube el volumen del audio de a poco (en "steps" pasos) para que no entre
// de golpe apenas se aprieta play. target = volumen final (0 a 1).
function fadeVolume(target, ms = 1500) {
  const steps = 30;
  const stepSize = target / steps;
  let i = 0;
  const id = setInterval(() => {
    i++;
    audio.volume = Math.min(target, stepSize * i);
    if (i >= steps) clearInterval(id);
  }, ms / steps);
}

// ---------- Chapter navigation ----------
// navItems: los 3 botones del menú lateral
// chapters: las 3 secciones .chapter (cada una con su video de fondo y título)
navItems.forEach((item) => {
  item.addEventListener('click', () => {
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
