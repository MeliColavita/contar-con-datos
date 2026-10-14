"""
Limpia buscador-datos.js: saca los códigos postales de los nombres de localidad,
junta las localidades que quedan repetidas y borra los mamógrafos duplicados.
Uso:  python limpiar_datos.py
Tiene que correrse en la misma carpeta que buscador-datos.js.
Después hay que volver a correr convertir_sin_mamografo.py (usa los nombres de la base).
"""
import re, json, unicodedata
ARCHIVO = 'buscador-datos.js'
# Nombres que se arreglan a mano (como están en la base -> como tienen que quedar)
RENOMBRAR = {
    'H500 Bsp Resistencia': 'Resistencia',
    'S3000 Ffd Santa Fe': 'Santa Fe Capital',
    'Ciudad de Goya': 'Goya',
}
def norm(s):
    s = unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', s.lower()).strip()
def limpiar_nombre(nombre):
    if nombre in RENOMBRAR:
        return RENOMBRAR[nombre]
    # código postal al principio: una letra + 3 o 4 números + hasta 3 letras (B6740, S2452dut)
    return re.sub(r'^[A-Za-z]\d{3,4}[A-Za-z]{0,3}\s+', '', nombre).strip()
txt = open(ARCHIVO, encoding='utf-8', newline='').read()
inicio = txt.index('const MAMOGRAFOS = ')
cabecera = txt[:inicio]
base = json.loads(txt[inicio + len('const MAMOGRAFOS = '):].rstrip().rstrip(';'))
juntas = {}
vistos = set()
for g in base:
    nombre = limpiar_nombre(g['localidad'])
    clave = (norm(nombre), g['provincia'])
    if clave not in juntas:
        juntas[clave] = dict(g, localidad=nombre, items=[])
    for m in g['items']:
        huella = (clave, norm(m['establecimiento']), norm(m.get('direccion', '')))
        if huella not in vistos:
            vistos.add(huella)
            juntas[clave]['items'].append(m)
limpias = [juntas[k] for k in sorted(juntas)]
lineas = [json.dumps(g, ensure_ascii=False, separators=(',', ':')) for g in limpias]
salida = cabecera + 'const MAMOGRAFOS = [\r\n' + ',\r\n'.join(lineas) + '\r\n];\r\n'
open(ARCHIVO, 'w', encoding='utf-8', newline='').write(salida)
print('Localidades:', len(base), '->', len(limpias))
print('Mamógrafos:', sum(len(g['items']) for g in base), '->', sum(len(g['items']) for g in limpias))
