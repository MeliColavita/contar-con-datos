// ============================================================
// SCRIPT.JS — lógica de: intro, audio, navegación entre capítulos
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
chapterVideos.forEach(v => {
  v.pause();
  v.currentTime = 0;
});

// ---------- Intro: el video aparece a los 10 segundos, desde el inicio ----------
// Como #introVideo ya no tiene "autoplay" (ver HTML), no se reprodujo
// nada todavía: a los 10s lo mandamos al frame 0 por las dudas y recién
// ahí lo arrancamos (play) al mismo tiempo que el fade-in (.visible).
setTimeout(() => {
  introVideo.currentTime = 0;
  introVideo.play().catch(err => console.warn('No se pudo reproducir el video de intro:', err));
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
audioBtn.addEventListener('click', (e) => {
  e.stopPropagation();

  if (audioHasEnded) {
    intro.classList.add('hidden');

    // Recién ahora arranca el video del módulo activo (capítulo 1 al
    // entrar por primera vez). Los capítulos 2 y 3 arrancan solos al
    // navegar a ellos (ver handler de navItems más abajo).
    const activeVideo = document.querySelector('.chapter-video.active');
    if (activeVideo) {
      activeVideo.currentTime = 0;
      activeVideo.play().catch(err => console.warn('No se pudo reproducir el video del capítulo activo:', err));
    }
    return;
  }

  if (audio.paused) {
    audio.volume = 0;
    audio.play()
      .then(() => {
        fadeVolume(0.45);                 // sube el volumen gradualmente hasta 0.45
        audioBtn.textContent = '🔊 Silenciar ⏸';
      })
      .catch(err => console.warn('No se pudo reproducir el audio:', err));
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
navItems.forEach(item => {
  item.addEventListener('click', () => {

    // Desactiva todos los nav-items, todos los capítulos y todos los videos...
    navItems.forEach(n => n.classList.remove('active'));
    chapters.forEach(c => c.classList.remove('active'));
    chapterVideos.forEach(v => v.classList.remove('active'));

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
      video.play().catch(err => console.warn('No se pudo reproducir el video del capítulo:', err)); // arranca recién ahora, al entrar al módulo
    }

    // Pausa los videos que quedaron ocultos (ahorra CPU/batería;
    // sin esto, los 3 videos quedan reproduciéndose todo el tiempo aunque
    // no se vean, que es justo lo que hacía que no arrancaran de cero).
    chapterVideos.forEach(v => {
      if (v !== video) v.pause();
    });

    // Reinicia la animación de los puntitos rosa alrededor del título.
    // Sin este truco, la animación CSS (dotPop) solo correría la primera vez:
    // al volver a agregar la clase .active, el navegador no la "re-dispara"
    // porque, para el motor de CSS, la animación ya había corrido antes.
    const dots = chapter.querySelectorAll('.dot');
    dots.forEach(dot => {
      dot.style.animation = 'none';   // saca la animación
      void dot.offsetWidth;            // fuerza un reflow (lee una propiedad de layout)
      dot.style.animation = '';        // se la devuelve: ahora arranca desde cero
    });
  });
});

// ============================================================
// MÓDULO "EL FUTURO" — visualización IA (capítulo 3)
// Todo encerrado en su propia IIFE con ids fv-* para no chocar
// con nada del resto del sitio.
// ============================================================
(function(){
  var g1 = document.getElementById('fv-g1');
  if(!g1) return; // el módulo no está en la página, no hacemos nada

  // ---------- Pestañas: 1.000 mujeres en control / Las que se escapaban ----------
  // Al clickear un botón .fv-tab: 1) le sacamos aria-selected a todos los
  // botones y la clase .active a todos los paneles, 2) le ponemos
  // aria-selected="true" solo al botón clickeado y .active solo al panel
  // que apunta su atributo aria-controls. El CSS hace el resto
  // (mostrar/ocultar) con .fv-tabpanel{display:none} / .active{display:block}.
  var fvTabBtns = document.querySelectorAll('.fv-tab');
  fvTabBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      fvTabBtns.forEach(function(b){ b.setAttribute('aria-selected', 'false'); });
      document.querySelectorAll('.fv-tabpanel').forEach(function(p){ p.classList.remove('active'); });
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(btn.getAttribute('aria-controls')).classList.add('active');
    });
  });

  // NS: namespace necesario para crear elementos <svg>/<circle> con JS puro
  // (document.createElementNS en vez de createElement).
  // rng(seed): generador de números "aleatorios" pero reproducibles (con la
  // misma seed siempre da los mismos números), así los puntos que se
  // encienden con la IA no cambian cada vez que se recarga la página.
  // el(tag, attrs): helper corto para crear un elemento SVG y setearle
  // atributos en una sola línea.
  var NS = "http://www.w3.org/2000/svg";
  function rng(seed){ return function(){ seed=(seed*16807)%2147483647; return (seed-1)/2147483646; }; }
  function el(t,a){ var e=document.createElementNS(NS,t); for(var k in a) e.setAttribute(k,a[k]); return e; }
  var fmt = function(v){ return Math.round(v).toLocaleString('es-AR'); }; // 1234567 -> "1.234.567"

  // ---------- Grilla 1: 1.000 mujeres ----------
  // 50 columnas x 20 filas = 1.000 puntos igual que antes, pero en
  // formato panorámico (más ancho que alto) para que la visualización
  // ocupe menos altura de pantalla. El viewBox del SVG en el HTML
  // (765x315) tiene que coincidir con cols*step y rows*step de acá abajo.
  var defs = el('defs',{});
  defs.innerHTML =
    '<radialGradient id="fv-rg"><stop offset="0" stop-color="#ffb35c" stop-opacity=".9"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>'+
    '<radialGradient id="fv-rp"><stop offset="0" stop-color="#ff6f9c" stop-opacity=".95"/><stop offset="1" stop-color="#ff6f9c" stop-opacity="0"/></radialGradient>';
  g1.appendChild(defs);

  var cols=50, rows=20, step=15, dots=[];
  for(var r=0;r<rows;r++){
    for(var c=0;c<cols;c++){
      var d = el('circle',{cx:7.5+c*step, cy:7.5+r*step, r:3.2, class:'fv-dot'});
      g1.appendChild(d);
      dots.push(d);
    }
  }

  var R = rng(11), picks=[];
  while(picks.length<6){
    var i = Math.floor(R()*1000);
    if(picks.indexOf(i)<0) picks.push(i);
  }
  var glows = picks.map(function(i,k){
    var cx=+dots[i].getAttribute('cx'), cy=+dots[i].getAttribute('cy');
    var gl = el('circle',{cx:cx, cy:cy, r:16, fill:k===5?'url(#fv-rp)':'url(#fv-rg)', class:'fv-glow'});
    g1.insertBefore(gl, g1.firstChild.nextSibling);
    return gl;
  });

  // ---------- Sin IA / Con IA ----------
  // Antes también existía una 3ra vista ("escala") que se mostraba u
  // ocultaba con un botón aparte. Ya no: la grilla y la barra de escala
  // están siempre visibles las dos (ver CSS), así que acá solo queda
  // la lógica de qué puntos enciende "Sin IA"/"Con IA".
  function setMode(con){
    document.getElementById('fv-m-sin').setAttribute('aria-pressed', !con);
    document.getElementById('fv-m-con').setAttribute('aria-pressed', con);
    picks.forEach(function(i,k){
      var on = k<5 || con;
      dots[i].setAttribute('class', 'fv-dot'+(on?(k===5?' fv-new':' fv-lit'):''));
      dots[i].setAttribute('r', on?4.6:3.2);
      glows[k].setAttribute('class', 'fv-glow'+(on?' fv-on':''));
    });
    document.getElementById('fv-r1').textContent = con?'6,1':'5,1';
    document.getElementById('fv-r1d').textContent = con?'+1':'\u00a0';
    document.getElementById('fv-r1dl').textContent = con?'cáncer más encontrado':'\u00a0';
  }
  document.getElementById('fv-m-sin').onclick = function(){ setMode(false); };
  document.getElementById('fv-m-con').onclick = function(){ setMode(true); };
  setMode(false);

  var n = document.getElementById('fv-n');
  function upd(){
    var v=+n.value, a=v*5.1/1000, b=v*6.1/1000;
    document.getElementById('fv-nlab').textContent = fmt(v)+' mujeres';
    document.getElementById('fv-s-sin').textContent = fmt(a);
    document.getElementById('fv-s-con').textContent = fmt(b);
    document.getElementById('fv-s-dif').textContent = '+'+fmt(Math.round(b)-Math.round(a));
  }
  n.oninput = upd;
  upd();

  // ---------- Grilla 2: 100 mujeres con cáncer ----------
  // 20 columnas x 5 filas = 100 puntos, en formato panorámico (viewBox
  // 800x200 en el HTML). Tiene que quedar más achatada/baja que la
  // grilla del panel 1 (765x315): si esta fuera más alta que esa (como
  // pasó al probar un formato cuadrado 10x10), pasa a ser ELLA la que
  // fija el alto compartido de los dos paneles (ver .fv-panels), y deja
  // un hueco vacío en el panel 1. Con esta forma más baja, el CSS
  // ("#fv-tabpanel-2 .fv-field") la hace crecer con seguridad hasta el
  // alto del panel 1, sin volver a provocar ese hueco.
  var g2 = document.getElementById('fv-g2');
  var d2 = el('defs',{});
  d2.innerHTML = defs.innerHTML.replace(/fv-rg/g,'fv-rg2').replace(/fv-rp/g,'fv-rp2');
  g2.appendChild(d2);

  var cells=[], gl2=[];
  for(var i2=0;i2<100;i2++){
    var cx = 20+(i2%20)*40, cy = 20+Math.floor(i2/20)*40;
    var gg = el('circle',{cx:cx, cy:cy, r:18, fill:'url(#fv-rp2)', class:'fv-glow'});
    g2.appendChild(gg); gl2.push(gg);
    var cc = el('circle',{cx:cx, cy:cy, r:7, class:'fv-dot'});
    g2.appendChild(cc); cells.push(cc);
  }

  var R2 = rng(7), order=[];
  while(order.length<100){
    var j = Math.floor(R2()*100);
    if(order.indexOf(j)<0) order.push(j);
  }
  var country='us', ai=false, vals={us:9.4, uk:2.7};

  function draw2(){
    ['fv-c-us','fv-c-uk'].forEach(function(id){
      document.getElementById(id).setAttribute('aria-pressed', id==='fv-c-'+country);
    });
    document.getElementById('fv-f-off').setAttribute('aria-pressed', !ai);
    document.getElementById('fv-f-on').setAttribute('aria-pressed', ai);
    var k = ai?Math.round(vals[country]):0;
    cells.forEach(function(c,idx){
      var on = order.indexOf(idx) < k;
      c.setAttribute('class', 'fv-dot'+(on?' fv-new':''));
      gl2[idx].setAttribute('class', 'fv-glow'+(on?' fv-on':''));
    });
    document.getElementById('fv-r2').textContent = ai?String(vals[country]).replace('.',','):'0';
    document.getElementById('fv-r2l').textContent = ai?'de cada 100 mujeres con cáncer, detectadas gracias a la IA':'Activá la IA para ver cuántas se recuperan';
  }
  document.getElementById('fv-c-us').onclick = function(){ country='us'; draw2(); };
  document.getElementById('fv-c-uk').onclick = function(){ country='uk'; draw2(); };
  document.getElementById('fv-f-off').onclick = function(){ ai=false; draw2(); };
  document.getElementById('fv-f-on').onclick = function(){ ai=true; draw2(); };
  draw2();
})();