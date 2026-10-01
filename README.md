# Cáncer de mama en Argentina

Sitio web sobre detección de cáncer de mama, en 3 capítulos.

## Quién hace qué
| Capítulo | Módulo | Persona | Prefijo | Archivos |
|---|---|---|---|---|
| 1 Argentina hoy | 1 | Emi | `em-` | `modulo1.css`, `modulo1.js` |
| 2 El tiempo | 2 | Brenda | `br-` | `modulo2.css`, `modulo2.js` |
| 3 El futuro | 3 | Meli | `me-` | `modulo3.css`, `modulo3.js` |

El HTML de cada módulo va dentro de su capítulo en `index.html` (hay un `<div class="ui-wrap ..-wrap">` esperándolo).

## Reglas
1. **Archivos generales** (`index.html` fuera de tu capítulo, `style.css`, `script.js`): no se tocan sin avisar al equipo. Ahí están los colores, la intro, el menú y los componentes compartidos `ui-*`.
2. Tus estilos y tu código van **solo** en tus archivos, con tu prefijo.
3. Usá las variables de color de `:root` (`--rose-strong`, `--panel`, `--text-dim`...) y los componentes `ui-*`. Nada de colores sueltos.
4. Un trabajo = una rama + Pull Request. Nadie sube directo a `main`.
5. Los videos y el audio **no** están en Git (`.gitignore`): copiarlos a mano a la carpeta del proyecto (`800 A.mp4`, `801.mp4`, `802.mp4`, `803 B.mp4`, `audio.mp3`).
