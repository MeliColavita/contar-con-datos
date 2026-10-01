// ============================================================
// MODULO3.JS — "EL FUTURO" (capítulo 3) — Meli — prefijo: me-
// Todo encerrado en su propia IIFE con ids me-* para no chocar
// con nada del resto del sitio. Helpers y pestañas: ver script.js.
// ============================================================
(function(){
  var g1 = document.getElementById('me-g1');
  if(!g1) return; // el módulo no está en la página, no hacemos nada

  // NS: namespace necesario para crear elementos <svg>/<circle> con JS puro
  // (document.createElementNS en vez de createElement).
  // rng(seed): generador de números "aleatorios" pero reproducibles (con la
  // misma seed siempre da los mismos números), así los puntos que se
  // encienden con la IA no cambian cada vez que se recarga la página.
  // el(tag, attrs): helper corto para crear un elemento SVG y setearle
  // atributos en una sola línea.
  var NS = UI.NS, rng = UI.rng, el = UI.el, fmt = UI.fmt; // helpers compartidos (ver script.js)

  // ---------- Grilla 1: 1.000 mujeres ----------
  // 50 columnas x 20 filas = 1.000 puntos igual que antes, pero en
  // formato panorámico (más ancho que alto) para que la visualización
  // ocupe menos altura de pantalla. El viewBox del SVG en el HTML
  // (765x315) tiene que coincidir con cols*step y rows*step de acá abajo.
  var defs = el('defs',{});
  defs.innerHTML =
    '<radialGradient id="me-rg"><stop offset="0" stop-color="#ffb35c" stop-opacity=".9"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>'+
    '<radialGradient id="me-rp"><stop offset="0" stop-color="#ff6f9c" stop-opacity=".95"/><stop offset="1" stop-color="#ff6f9c" stop-opacity="0"/></radialGradient>';
  g1.appendChild(defs);

  var cols=50, rows=20, step=15, dots=[];
  for(var r=0;r<rows;r++){
    for(var c=0;c<cols;c++){
      var d = el('circle',{cx:7.5+c*step, cy:7.5+r*step, r:3.2, class:'me-dot'});
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
    var gl = el('circle',{cx:cx, cy:cy, r:16, fill:k===5?'url(#me-rp)':'url(#me-rg)', class:'me-glow'});
    g1.insertBefore(gl, g1.firstChild.nextSibling);
    return gl;
  });

  // ---------- Sin IA / Con IA ----------
  // Antes también existía una 3ra vista ("escala") que se mostraba u
  // ocultaba con un botón aparte. Ya no: la grilla y la barra de escala
  // están siempre visibles las dos (ver CSS), así que acá solo queda
  // la lógica de qué puntos enciende "Sin IA"/"Con IA".
  function setMode(con){
    document.getElementById('me-m-sin').setAttribute('aria-pressed', !con);
    document.getElementById('me-m-con').setAttribute('aria-pressed', con);
    picks.forEach(function(i,k){
      var on = k<5 || con;
      dots[i].setAttribute('class', 'me-dot'+(on?(k===5?' me-new':' me-lit'):''));
      dots[i].setAttribute('r', on?4.6:3.2);
      glows[k].setAttribute('class', 'me-glow'+(on?' me-on':''));
    });
    document.getElementById('me-r1').textContent = con?'6,1':'5,1';
    document.getElementById('me-r1d').textContent = con?'+1':'\u00a0';
    document.getElementById('me-r1dl').textContent = con?'cáncer más encontrado':'\u00a0';
  }
  document.getElementById('me-m-sin').onclick = function(){ setMode(false); };
  document.getElementById('me-m-con').onclick = function(){ setMode(true); };
  setMode(false);

  var n = document.getElementById('me-n');
  function upd(){
    var v=+n.value, a=v*5.1/1000, b=v*6.1/1000;
    document.getElementById('me-nlab').textContent = fmt(v)+' mujeres';
    document.getElementById('me-s-sin').textContent = fmt(a);
    document.getElementById('me-s-con').textContent = fmt(b);
    document.getElementById('me-s-dif').textContent = '+'+fmt(Math.round(b)-Math.round(a));
  }
  n.oninput = upd;
  upd();

  // ---------- Grilla 2: 100 mujeres con cáncer ----------
  // 20 columnas x 5 filas = 100 puntos, en formato panorámico (viewBox
  // 800x200 en el HTML). Tiene que quedar más achatada/baja que la
  // grilla del panel 1 (765x315): si esta fuera más alta que esa (como
  // pasó al probar un formato cuadrado 10x10), pasa a ser ELLA la que
  // fija el alto compartido de los dos paneles (ver .ui-panels), y deja
  // un hueco vacío en el panel 1. Con esta forma más baja, el CSS
  // ("#me-tabpanel-2 .ui-field") la hace crecer con seguridad hasta el
  // alto del panel 1, sin volver a provocar ese hueco.
  var g2 = document.getElementById('me-g2');
  var d2 = el('defs',{});
  d2.innerHTML = defs.innerHTML.replace(/me-rg/g,'me-rg2').replace(/me-rp/g,'me-rp2');
  g2.appendChild(d2);

  var cells=[], gl2=[];
  for(var i2=0;i2<100;i2++){
    var cx = 20+(i2%20)*40, cy = 20+Math.floor(i2/20)*40;
    var gg = el('circle',{cx:cx, cy:cy, r:18, fill:'url(#me-rp2)', class:'me-glow'});
    g2.appendChild(gg); gl2.push(gg);
    var cc = el('circle',{cx:cx, cy:cy, r:7, class:'me-dot'});
    g2.appendChild(cc); cells.push(cc);
  }

  var R2 = rng(7), order=[];
  while(order.length<100){
    var j = Math.floor(R2()*100);
    if(order.indexOf(j)<0) order.push(j);
  }
  var country='us', ai=false, vals={us:9.4, uk:2.7};

  function draw2(){
    ['me-c-us','me-c-uk'].forEach(function(id){
      document.getElementById(id).setAttribute('aria-pressed', id==='me-c-'+country);
    });
    document.getElementById('me-f-off').setAttribute('aria-pressed', !ai);
    document.getElementById('me-f-on').setAttribute('aria-pressed', ai);
    var k = ai?Math.round(vals[country]):0;
    cells.forEach(function(c,idx){
      var on = order.indexOf(idx) < k;
      c.setAttribute('class', 'me-dot'+(on?' me-new':''));
      gl2[idx].setAttribute('class', 'me-glow'+(on?' me-on':''));
    });
    document.getElementById('me-r2').textContent = ai?String(vals[country]).replace('.',','):'0';
    document.getElementById('me-r2l').textContent = ai?'de cada 100 mujeres con cáncer, detectadas gracias a la IA':'Activá la IA para ver cuántas se recuperan';
  }
  document.getElementById('me-c-us').onclick = function(){ country='us'; draw2(); };
  document.getElementById('me-c-uk').onclick = function(){ country='uk'; draw2(); };
  document.getElementById('me-f-off').onclick = function(){ ai=false; draw2(); };
  document.getElementById('me-f-on').onclick = function(){ ai=true; draw2(); };
  draw2();
})();