# Videollamada Privada

Aplicación de videollamadas privadas basada en LiveKit. Se crea una
sala con un ID impredecible, se comparte el enlace y los medios se
publican a la SFU de LiveKit; el backend nunca transporta audio o
video.

**Estado actual: Fase 16 de 16 — auditoría final y release candidate.**
El backend crea y valida salas, y emite tokens de acceso para LiveKit
(`POST /livekit/token`). El cliente conecta la
sala LiveKit, publica cámara y micrófono existentes, y reproduce los
tracks remotos. El signaling P2P propio, las ofertas/respuestas, los
candidatos ICE y el WebSocket de la aplicación ya no participan en
una llamada activa. El backend crea cada sala en LiveKit con límite de
10 participantes,
verifica la capacidad antes de emitir un token y devuelve un rechazo
controlado si se intenta ingresar como participante 11.

El cliente mantiene un arreglo `participants[]` a partir de los
eventos de LiveKit: detecta entradas y salidas, asocia los tracks de
audio/video con la identidad estable del participante y reconstruye
el snapshot después de una reconexión. La interfaz presenta un grid
responsive de 1–10 tiles con avatar, nombre y estados de audio y
conexión.

Al finalizar una llamada se despublican los tracks, se desconecta de
LiveKit sin dejar listeners activos y se liberan cámara y micrófono.
La reconexión mantiene el estado de participantes mientras LiveKit la
recupera y actualiza el estado visual durante el proceso.

Durante una llamada, los controles de micrófono y cámara silencian o
reactivan las publicaciones locales de LiveKit. También se puede elegir
otro micrófono o cámara: el cliente reemplaza el track publicado sin
desconectar la llamada.

El chat usa Data Packets confiables de LiveKit: todos los participantes
de la sala reciben los mensajes y cada cliente mantiene su historial
solamente mientras dura su sesión.

La pantalla puede compartirse desde el control de llamada. LiveKit
publica ese track por separado de la cámara, y los demás participantes
lo ven identificado como pantalla compartida.

La grabación es opcional y server-side: cuando se configura LiveKit
Egress y un bucket S3 compatible, se puede iniciar o detener desde la
llamada. Las claves de LiveKit, S3 y control no llegan al navegador.

## Estructura

```
/frontend   React + TypeScript + Vite (mobile-first)
/backend    Node.js + TypeScript (API de salas y tokens LiveKit)
/shared     Tipos y contratos compartidos entre frontend y backend (workspace real de npm)
```

El paquete `shared` se compila antes del frontend y backend. Sus artefactos
`dist` son necesarios para ejecutar el backend compilado con Node en producción.

## Requisitos

- Node.js 20+ (probado con Node 22)
- npm 10+

## Desarrollo local

Instalar dependencias (una sola vez, desde la raíz — es un monorepo
con npm workspaces):

```bash
npm install
```

Copiar las variables de entorno de ejemplo:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Levantar backend y frontend en dos terminales distintas (o usando los
scripts de conveniencia desde la raíz):

```bash
npm run dev:backend    # http://localhost:8787
npm run dev:frontend   # http://localhost:5173
```

Al abrir `http://localhost:5173` deberías ver "Estado del backend: online",
lo que confirma que el frontend puede llegar al endpoint `/health` del
backend.

## Variables de entorno

### backend/.env

| Variable      | Descripción                                   | Default                 |
|---------------|------------------------------------------------|--------------------------|
| `PORT`        | Puerto del servidor backend                    | `8787`                   |
| `NODE_ENV`    | `development` \| `production` \| `test`        | `development`            |
| `CORS_ORIGIN` | Origen permitido para CORS                     | `http://localhost:5173`  |
| `TRUST_PROXY` | Confía en un único proxy inverso para obtener la IP | `false`              |
| `LIVEKIT_URL` | URL `wss://` del servidor LiveKit              | —                         |
| `LIVEKIT_API_KEY` | API key de LiveKit                         | —                         |
| `LIVEKIT_API_SECRET` | API secret de LiveKit                   | —                         |
| `LIVEKIT_TOKEN_TTL_SECONDS` | Caducidad del token LiveKit en segundos | `900`              |
| `RECORDING_ENABLED` | Habilita LiveKit Egress                 | `false`                   |
| `RECORDING_CONTROL_SECRET` | Firma las credenciales efímeras de control | —                    |
| `RECORDING_S3_*` | Credenciales y destino S3 de grabaciones | —                         |

### frontend/.env

| Variable             | Descripción                | Default                  |
|----------------------|-----------------------------|---------------------------|
| `VITE_API_BASE_URL`  | URL base del backend        | `http://localhost:8787`  |

## Despliegue de producción

La SFU no se despliega en Render: usá LiveKit Cloud o una instalación de
LiveKit con TURN correctamente configurado. El backend Express solo crea salas
y emite tokens; los navegadores se conectan directamente a LiveKit por WSS.

1. Creá un proyecto en LiveKit Cloud y guardá su URL `wss://`, API key y API
   secret exclusivamente en el backend.
2. Importá este repositorio en Render como Blueprint. El archivo
   [`render.yaml`](render.yaml) crea el servicio de API, compila el monorepo,
   usa `GET /health` como health check y espera el cierre ordenado durante los
   despliegues. Elegí una región próxima a los usuarios y a LiveKit.
3. En Render cargá los valores marcados como secretos: `LIVEKIT_URL`,
   `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` y `CORS_ORIGIN`. Este último debe
   ser la URL HTTPS final de Netlify (o una lista separada por comas). No
   copies ningún secreto en variables `VITE_*`.
4. Con el dominio HTTPS de Render ya disponible, creá el sitio en Netlify. El
   archivo [`netlify.toml`](netlify.toml) construye `frontend/dist` y conserva
   las rutas SPA. Definí `VITE_API_BASE_URL=https://tu-api.onrender.com` antes
   de desplegar; el build de producción rechaza una URL ausente o no HTTPS.
5. Agregá dominios propios HTTPS en ambos proveedores, actualizá
   `CORS_ORIGIN` con el dominio real del frontend y redeplegá el backend.

`/health` sirve para disponibilidad del proceso y no requiere credenciales.
Las comprobaciones de LiveKit suceden al crear una sala o emitir un token, de
modo que un health check no expone claves ni genera tráfico contra la SFU.

La aplicación no administra WebSocket, ICE ni TURN propios: LiveKit Cloud
proporciona la señalización, conectividad ICE/TURN y medios. Para infraestructura
propia, el operador debe publicar LiveKit por HTTPS/WSS y configurar TURN/TLS,
UDP y TCP de acuerdo con la red objetivo. No uses Render Free como SFU: es
apropiado solamente para esta API, y sus límites/cold starts deben evaluarse
antes de usarla en producción.

El estado de las salas y el rate limit son deliberadamente locales a una única
instancia. Para escalar el backend horizontalmente hay que mover ambos a un
almacenamiento compartido antes de aumentar réplicas.

## Scripts útiles (desde la raíz)

- `npm run dev:frontend` — corre Vite en modo desarrollo.
- `npm run dev:backend` — corre el backend con recarga automática (`tsx watch`).
- `npm run build:frontend` / `npm run build:backend` — build de producción.
- `npm run typecheck` — chequeo de tipos de los tres paquetes.
- `npm run lint:backend` — lint del backend.

## Seguridad

El backend emite identidades aleatorias y tokens de LiveKit limitados a una
sala, con caducidad de 15 minutos por defecto. CORS solo permite los orígenes
explícitos configurados, nunca `*`; se pueden separar varios con comas.
Los endpoints que crean salas, emiten tokens o controlan grabaciones tienen
límites por IP, cuerpos JSON de hasta 16 KB y respuestas de error que no
exponen secretos. Los límites son locales a cada instancia; un despliegue con
múltiples instancias debe aplicar un rate limiter compartido o del proveedor.

## Roadmap (16 fases)

El desarrollo avanza estrictamente una fase por vez, con autorización
explícita antes de continuar. Fase actual: **16/16 — auditoría final y release candidate.**
La auditoría y los criterios pendientes de aceptación están en
[`FINAL_AUDIT.md`](FINAL_AUDIT.md).

## Principios de arquitectura

- Salas privadas (`/call/:roomId`), sin matchmaking ni usuarios aleatorios.
- LiveKit transporta los medios a través de una SFU; el backend solo
  crea salas y autoriza el acceso mediante tokens.
- No se graban ni almacenan videollamadas ni mensajes de chat.
- Priorizar siempre free tier / costo $0 en la primera versión, sin
  sacrificar la arquitectura a largo plazo.
