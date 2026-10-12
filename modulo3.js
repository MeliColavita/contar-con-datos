// ============================================================
// MODULO3.JS — "EL FUTURO" (Capítulo 3) — Meli — prefijo: me-
// ============================================================
// Las pestañas del módulo quedaron vacías. Lo único que hace este archivo
// es el botón "Final": pausa el video 3, oculta su fundido y reproduce
// 04_FINAL.mp4 desde el principio (si se vuelve a tocar, reinicia).
// Al cambiar de capítulo con el menú, script.js pausa y oculta el video 4.
// ============================================================
(function () {
  const bFinal = document.getElementById('me-final');
  const video3 = document.querySelector('.chapter-video[data-chapter="3"]');
  const video4 = document.getElementById('me-video4');
  if (!bFinal || !video3 || !video4) return;

  bFinal.onclick = () => {
    video3.pause();
    video3.classList.remove('active');
    video4.classList.add('active');
    video4.currentTime = 0;
    video4.play().catch((err) => console.warn('No se pudo reproducir 04_FINAL:', err));
  };
})();
