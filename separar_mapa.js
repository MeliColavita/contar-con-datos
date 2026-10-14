const fs = require('fs');

const s = fs.readFileSync('modulo2.js', 'utf8');

const ini = s.indexOf('  const DATA = {');
const fin = s.search(/\r?\n\s*\/\/ =+\r?\n\s*\/\/ \(B\) Pestaña/);
if (ini < 0 || fin < 0) {
  console.error('No encontré el bloque DATA. No se modificó nada.');
  process.exit(1);
}

let bloque = s.slice(ini, fin).trim();
bloque = bloque.replace(/^const DATA = /, 'const MAPA_PROVINCIAS = ');

fs.writeFileSync(
  'mapa_provincias.js',
  '// Contornos de provincias (SVG) y centroides. Dato puro, no tocar.\n' + bloque + '\n',
);
fs.writeFileSync(
  'modulo2.js',
  s.slice(0, ini) + '  const DATA = MAPA_PROVINCIAS;\n' + s.slice(fin),
);
console.log('Listo: mapa_provincias.js creado y modulo2.js achicado.');
