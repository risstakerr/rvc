# Videollamada Privada

Aplicación de videollamadas privadas 1 a 1: creás una sala, compartís
el enlace con una sola persona y hablan por video/audio con WebRTC
P2P. No es matchmaking aleatorio ni tiene desconocidos: la estética
minimalista (dos cámaras visibles + chat lateral) está inspirada
visualmente en Omegle, pero el producto es conceptualmente similar a
Google Meet/Zoom, mucho más simple.

**Estado actual: Fase 6 de 16 — WebRTC P2P.**
El backend genera salas reales con ID impredecible (`POST /rooms`) y
las valida (`GET /rooms/:roomId`). El Home pide cámara/micrófono
reales y tiene un botón "Crear llamada" que crea la sala, actualiza
la URL a `/call/:roomId` (History API nativa, sin react-router) y
muestra una pantalla para copiar el enlace. Abrir un enlace
`/call/:roomId` directamente valida la sala contra el backend. El
backend de signaling por WebSocket (`/ws`) maneja join/leave,
reenvío de offer/answer/ICE candidates y el límite real de 2
participantes por sala (Fase 5). El frontend ahora establece la
conexión WebRTC P2P real entre los dos navegadores
(`RTCPeerConnection`, con STUN público): quien se une y encuentra al
otro participante ya esperando arma la oferta, el otro responde, y
ambas cámaras remotas quedan visibles en la pantalla de llamada. Si
la sala ya tiene 2 personas, se muestra "Esta llamada ya está
completa.". Reconexión automática tras cortes, interfaz definitiva y
chat lateral todavía no están implementados (fases 7, 8 y 10).

## Estructura

```
/frontend   React + TypeScript + Vite (mobile-first)
/backend    Node.js + TypeScript (servidor de signaling de salas, luego)
/shared     Tipos y contratos compartidos entre frontend y backend (workspace real de npm)
```

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

### frontend/.env

| Variable             | Descripción                | Default                  |
|----------------------|-----------------------------|---------------------------|
| `VITE_API_BASE_URL`  | URL base del backend        | `http://localhost:8787`  |

## Scripts útiles (desde la raíz)

- `npm run dev:frontend` — corre Vite en modo desarrollo.
- `npm run dev:backend` — corre el backend con recarga automática (`tsx watch`).
- `npm run build:frontend` / `npm run build:backend` — build de producción.
- `npm run typecheck` — chequeo de tipos de los tres paquetes.
- `npm run lint:backend` — lint del backend.

## Roadmap (16 fases)

El desarrollo avanza estrictamente una fase por vez, con autorización
explícita antes de continuar. Fase actual: **6/16 — WebRTC P2P.**

## Principios de arquitectura

- Salas privadas de máximo 2 participantes (`/call/:roomId`), sin
  matchmaking ni usuarios aleatorios.
- WebRTC P2P entre los dos usuarios; el servidor solo hace creación
  de salas, signaling y presencia (nunca transporta video/audio salvo
  fallback TURN futuro).
- No se graban ni almacenan videollamadas ni mensajes de chat.
- Priorizar siempre free tier / costo $0 en la primera versión, sin
  sacrificar la arquitectura a largo plazo.
