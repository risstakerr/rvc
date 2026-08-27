# Auditoría final — Release Candidate

Fecha: 2026-08-27

## Veredicto

El proyecto es un **Release Candidate** para una instalación de una sola
instancia de API con LiveKit Cloud (o una SFU LiveKit correctamente operada).
No debe declararse listo para escalado horizontal ni para grabación hasta
probar dichas integraciones con las credenciales y el almacenamiento reales.

## Funcionalidades implementadas

- Creación de salas privadas con IDs aleatorios de 10 caracteres y validación
  compartida entre cliente y servidor.
- LiveKit como SFU: creación de sala, máximo de 10 participantes y emisión de
  JWT por identidad aleatoria, limitado a una sala y con caducidad configurable.
- Cámara, micrófono, selección de dispositivos, silenciamiento y reemplazo de
  tracks sin abandonar la llamada.
- Reconexión y reconstrucción del listado de participantes a partir de eventos
  de LiveKit.
- Grid responsive de hasta 10 tiles, incluidos los tiles de pantallas
  compartidas; el exceso visual se limita a diez.
- Chat efímero mediante Data Packets confiables de LiveKit, con límite de 1000
  caracteres por mensaje.
- Compartir pantalla, incluidos el fin de la compartición y la visualización
  remota.
- Grabación server-side opcional por LiveKit Egress con salida S3 compatible,
  nombre de archivo no predecible y prevención de grabación duplicada.
- Controles de grabación protegidos con credencial firmada, temporal y ligada a
  una sala.
- CORS de lista explícita, cabeceras de seguridad, validación de JSON e input,
  límites locales por IP y errores que no exponen secretos.
- Configuración de Render mediante `render.yaml`, health check `/health`, cierre
  ordenado y hosting SPA para Netlify mediante `netlify.toml`.

## Seguridad y secretos

- Las claves de LiveKit, S3 y control de grabación existen solo como variables
  del backend y están excluidas por `.gitignore`.
- El frontend solo recibe la URL pública de LiveKit y tokens temporales.
- Producción exige CORS HTTPS explícito, URL LiveKit `wss://` y credenciales
  LiveKit; `VITE_API_BASE_URL` también exige HTTPS en producción.
- `TRUST_PROXY=true` está declarado para Render, de modo que los límites usan
  la IP del cliente a través de un único proxy confiable.

## Tests ejecutados

| Prueba | Resultado |
|---|---|
| Compilación de `shared` | Correcta |
| Compilación de backend TypeScript | Correcta |
| Compilación de frontend Vite | Correcta |
| Typecheck de los tres workspaces | Correcto |
| ESLint del backend | Correcto |
| Smoke test del backend compilado: `GET /health` | `200` con cabeceras de seguridad |
| Carga de configuración de producción con valores de prueba | Correcta |
| Comprobación de whitespace con `git diff --check` | Correcta |

Durante la auditoría, el primer arranque del backend compilado falló porque
`@pvc/shared` exportaba sus fuentes TypeScript. Se corrigió para exportar
`shared/dist`, y los scripts raíz ahora compilan `shared` antes de frontend y
backend. El smoke test posterior respondió correctamente.

## Pruebas manuales pendientes

No se ejecutaron contra una infraestructura LiveKit real en esta auditoría:

- Dos, tres, cinco y diez participantes simultáneos.
- Intento de ingreso del participante 11.
- Reconexión por corte de red y recuperación de tracks.
- Cámara, micrófono, cambio de dispositivo y screen share en Chrome, Firefox,
  Safari/iOS y Android.
- Chat entre clientes, audio remoto y grabación Egress de inicio a fin.
- CORS, dominio propio y HTTPS en los hosts definitivos.

Estos casos son criterios obligatorios de aceptación antes de abrir el servicio
a usuarios reales. No se marcan como fallos del código: requieren credenciales,
navegadores, dispositivos y una SFU que no están disponibles en este entorno.

## Bugs conocidos y deuda técnica

- Salas, rate limiting y estados de grabación están en memoria. Un reinicio
  invalida las salas existentes; múltiples instancias no comparten estado.
- El estado de Egress no consume webhooks de LiveKit, por lo que no refleja
  eventos asíncronos del proveedor después de iniciar o detener una grabación.
- La credencial de control de grabación es bearer y dura dos horas; no se
  verifica que su identidad siga conectada. Para roles de anfitrión reales se
  necesita autenticación de usuarios y revocación.
- El historial de chat vive en memoria del navegador durante la sesión y no
  tiene un límite de cantidad de mensajes.
- El bundle inicial del frontend mide aproximadamente 736 kB sin comprimir;
  Vite informó una advertencia de chunk mayor a 500 kB. Conviene separar
  dinámicamente los módulos de llamada/LiveKit antes de una audiencia amplia.
- No hay suite automatizada de unit, integración ni E2E todavía.

## Infraestructura necesaria

- LiveKit Cloud, o una SFU LiveKit propia con HTTPS/WSS, TURN TLS y conectividad
  UDP/TCP adecuados. Render no hospeda la SFU.
- Un servicio web Node para la API; `render.yaml` está preparado para Render.
- Un sitio estático HTTPS para el frontend; `netlify.toml` está preparado para
  Netlify.
- Un bucket S3 compatible y LiveKit Egress únicamente si se habilita grabación.
- Redis o almacenamiento equivalente antes de escalar el backend a más de una
  instancia.

## Instrucciones de deployment

1. Crear/configurar LiveKit y conservar URL `wss://`, API key y API secret en
   el gestor de secretos del backend.
2. Importar el repositorio como Blueprint en Render. Cargar `CORS_ORIGIN` con
   el dominio HTTPS del frontend y los tres secretos de LiveKit; mantener
   `NODE_ENV=production` y `TRUST_PROXY=true`.
3. Crear el sitio Netlify y definir
   `VITE_API_BASE_URL=https://<api>.onrender.com` antes del build.
4. Configurar los dominios HTTPS finales, actualizar `CORS_ORIGIN` y redeplegar
   el backend.
5. Ejecutar todas las pruebas manuales pendientes, incluidos los escenarios de
   capacidad, red y dispositivos, antes de liberar a usuarios.
