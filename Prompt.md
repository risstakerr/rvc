Quiero desarrollar una aplicación de VIDEOLLAMADAS PRIVADAS 1 A 1.

IMPORTANTE:

La aplicación NO es Omegle.

NO quiero:

* matchmaking aleatorio;
* buscar desconocidos;
* cola de usuarios;
* usuarios aleatorios;
* botón "Siguiente" para cambiar de persona;
* filtros para encontrar personas;
* Chatroulette;
* conexión automática con desconocidos.

Lo único que quiero tomar de la estética de Omegle es la idea de una interfaz extremadamente simple donde las dos cámaras estén visibles y exista un chat lateral.

El producto real debe ser una aplicación de videollamadas privadas, similar conceptualmente a Google Meet/Zoom, pero mucho más simple y con una interfaz propia inspirada visualmente en Omegle.

==================================================
OBJETIVO DEL PRODUCTO
=====================

El usuario entra a la aplicación y puede:

1. Crear una sala privada.
2. Obtener un enlace único.
3. Compartir ese enlace con otra persona.
4. La otra persona abre el enlace.
5. Ambos entran a la misma videollamada.
6. Se muestran las dos cámaras.
7. Existe un chat lateral.
8. Pueden hablar por video y audio.
9. Pueden apagar/encender cámara y micrófono.
10. Pueden compartir pantalla.
11. Pueden abandonar la llamada.

Flujo:

CREAR LLAMADA
↓
GENERAR SALA
↓
COPIAR ENLACE
↓
ENVIAR ENLACE
↓
SEGUNDO USUARIO ENTRA
↓
WEBRTC
↓
VIDEOLLAMADA 1 A 1

==================================================
DISEÑO DE LA INTERFAZ
=====================

Quiero una interfaz minimalista, moderna y rápida.

La pantalla principal de la llamada debe estar dividida aproximadamente así:

┌─────────────────────────────────────────────┐
│                                             │
│   ┌─────────────────┐  ┌─────────────────┐ │
│   │                 │  │                 │ │
│   │   CÁMARA LOCAL  │  │ CÁMARA REMOTA  │ │
│   │                 │  │                 │ │
│   │                 │  │                 │ │
│   └─────────────────┘  └─────────────────┘ │
│                                             │
│                                             │
├───────────────────────────────────┬─────────┤
│                                   │  CHAT   │
│                                   │         │
│                                   │ Hola    │
│                                   │         │
│                                   │ ¿Me ves?│
│                                   │         │
│                                   │─────────│
│                                   │ Escribir│
└───────────────────────────────────┴─────────┘

La interfaz debe funcionar perfectamente en:

* Desktop.
* Laptop.
* Tablet.
* Celular.

En móvil debe adaptarse inteligentemente.

NO quiero una copia visual exacta de Omegle.

Quiero una identidad visual propia.

==================================================
TECNOLOGÍA
==========

Si el proyecto ya tiene tecnologías elegidas, primero analizarlas y reutilizarlas cuando sea razonable.

Si no existe un stack definido, utilizar preferentemente:

Frontend:

* React
* TypeScript
* Vite

Backend:

* Node.js
* TypeScript

Realtime:

* WebSocket

Video:

* WebRTC

Base de datos:

* PostgreSQL/Supabase solamente cuando sea necesario.

La aplicación debe estar diseñada para funcionar inicialmente con infraestructura gratuita o free tiers.

NO asumir servicios pagos.

==================================================
ARQUITECTURA WEBRTC
===================

La arquitectura principal debe ser:

USUARIO A
│
│
WebRTC P2P
│
│
USUARIO B

El servidor NO debe transportar el video cuando pueda evitarse.

El backend debe encargarse principalmente de:

* crear salas;
* validar salas;
* controlar participantes;
* signaling;
* intercambio SDP;
* intercambio ICE candidates;
* presencia;
* estado de conexión;
* desconexión.

WebRTC debe encargarse de:

* audio;
* video;
* conexión entre participantes;
* datos realtime cuando corresponda.

Preparar arquitectura para utilizar TURN cuando una conexión P2P directa no sea posible.

==================================================
CHAT
====

La llamada debe tener un chat lateral.

El chat debe permitir:

* enviar mensajes;
* recibir mensajes en tiempo real;
* mostrar quién envió el mensaje;
* timestamps;
* autoscroll;
* estado vacío;
* manejo de errores.

Preferentemente utilizar WebRTC DataChannel para evitar infraestructura innecesaria, siempre que la arquitectura resulte estable.

Si WebRTC DataChannel no es la mejor opción para una determinada implementación, utilizar WebSocket.

NO guardar mensajes permanentemente salvo que posteriormente sea solicitado.

==================================================
SALAS
=====

Cada llamada debe tener una sala privada.

Ejemplo:

/call/ABC123

La sala debe:

* permitir máximo 2 participantes;
* tener un identificador único;
* expirar cuando corresponda;
* detectar cuándo entra el segundo participante;
* impedir que entre un tercero;
* manejar correctamente desconexiones.

Si alguien intenta entrar cuando hay 2 participantes:

Mostrar:

"Esta llamada ya está completa."

==================================================
SIN CUENTAS OBLIGATORIAS
========================

El MVP NO debe requerir registro obligatorio.

Una persona debe poder:

Crear llamada
↓
Obtener enlace
↓
Compartirlo
↓
La otra persona entra

No quiero complicar el MVP con perfiles, seguidores, contactos ni redes sociales.

La autenticación podrá agregarse posteriormente.

==================================================
CONTROLES DE LLAMADA
====================

Implementar:

🎤 Micrófono ON/OFF

📹 Cámara ON/OFF

🖥️ Compartir pantalla

💬 Abrir/cerrar chat

📋 Copiar enlace

📞 Finalizar llamada

También mostrar:

* estado de conexión;
* cámara desactivada;
* micrófono silenciado;
* reconectando;
* participante desconectado.

==================================================
VELOCIDAD
=========

La aplicación debe estar optimizada para que la llamada comience lo más rápido posible.

Prioridad:

1. Conexión rápida.
2. Audio estable.
3. Video fluido.
4. Calidad adaptativa.

No cargar librerías innecesarias.

No crear una arquitectura excesivamente compleja.

==================================================
SEGURIDAD
=========

Implementar desde el principio:

* IDs de sala suficientemente impredecibles;
* validación de entrada;
* rate limiting básico;
* protección contra abuso;
* límite de 2 participantes;
* cierre correcto de conexiones;
* limpieza de streams;
* cierre de RTCPeerConnection;
* cierre de WebSocket;
* protección contra múltiples conexiones del mismo participante.

No guardar:

* videos;
* audios;
* grabaciones;
* mensajes permanentemente.

==================================================
16 FASES
========

FASE 1 — AUDITORÍA Y REDEFINICIÓN DEL PROYECTO

Primero inspeccioná completamente el proyecto existente.

IMPORTANTE:

El proyecto pudo haber comenzado siguiendo una arquitectura equivocada orientada a Omegle/matchmaking.

Identificá y eliminá conceptualmente cualquier requisito de:

* matchmaking aleatorio;
* cola;
* usuarios desconocidos;
* "Siguiente";
* búsqueda aleatoria.

NO borres código útil sin analizarlo primero.

Definí la arquitectura correcta para:

VIDEOLLAMADAS PRIVADAS 1 A 1.

No implementes todavía funcionalidades de la Fase 2.

---

FASE 2 — ESTRUCTURA BASE DE LA APP

Construir/refactorizar:

* frontend;
* backend;
* shared;
* configuración;
* TypeScript;
* scripts;
* entorno de desarrollo.

La aplicación debe compilar y ejecutarse correctamente.

---

FASE 3 — HOME Y CREACIÓN DE SALAS

Crear la pantalla inicial:

"Crear una videollamada"

Botón:

"Crear llamada"

Al pulsarlo:

* crear una sala;
* generar ID;
* mostrar enlace;
* permitir copiarlo.

Crear pantalla para acceder mediante:

/call/:roomId

---

FASE 4 — PERMISOS DE CÁMARA Y MICRÓFONO

Implementar:

* getUserMedia;
* cámara;
* micrófono;
* preview;
* permisos;
* errores;
* dispositivos no disponibles.

Crear una pantalla previa a entrar a la llamada.

---

FASE 5 — WEBSOCKET SIGNALING

Implementar backend de signaling.

Debe manejar:

* rooms;
* participantes;
* join;
* leave;
* offer;
* answer;
* ICE candidates;
* desconexiones.

Máximo:

2 participantes por sala.

---

FASE 6 — WEBRTC P2P

Implementar RTCPeerConnection.

Conectar:

Usuario A
↕
WebRTC
↕
Usuario B

Implementar:

* offer;
* answer;
* ICE;
* local stream;
* remote stream.

La videollamada debe funcionar realmente entre dos navegadores.

---

FASE 7 — INTERFAZ DE VIDEOLLAMADA

Construir la interfaz definitiva:

* cámara local;
* cámara remota;
* controles;
* estado de conexión;
* responsive.

Priorizar una experiencia visual limpia y simple.

---

FASE 8 — CHAT LATERAL

Implementar chat realtime.

Diseño:

Video
+
Chat lateral

En desktop:

70-80% video
20-30% chat

En móvil:

video
↓
chat

El usuario debe poder ocultar/mostrar el chat.

---

FASE 9 — CONTROLES AVANZADOS

Implementar:

* micrófono;
* cámara;
* compartir pantalla;
* fullscreen;
* copiar enlace;
* finalizar llamada.

Todos deben funcionar realmente.

No crear botones decorativos.

---

FASE 10 — RECONEXIÓN Y ESTADOS

Implementar correctamente:

* conexión perdida;
* reconexión;
* participante abandonó;
* participante volvió;
* refresh de página;
* cierre de pestaña;
* conexión lenta.

Evitar estados inconsistentes.

---

FASE 11 — SEGURIDAD

Auditar:

* salas;
* WebSockets;
* WebRTC signaling;
* IDs;
* input;
* rate limits;
* conexiones duplicadas;
* acceso de terceros.

Impedir que un tercero pueda entrar fácilmente a una llamada privada.

---

FASE 12 — OPTIMIZACIÓN

Optimizar:

* tiempo hasta primera imagen;
* tiempo de conexión;
* bitrate;
* resolución;
* adaptación a conexión;
* consumo de CPU;
* memoria;
* dispositivos móviles.

Priorizar velocidad y estabilidad.

---

FASE 13 — STUN / TURN

Implementar configuración STUN.

Preparar soporte TURN.

La aplicación debe poder funcionar inicialmente sin TURN si la conexión P2P lo permite.

Dejar toda configuración mediante variables de entorno.

No introducir servicios pagos obligatorios.

---

FASE 14 — PWA Y MOBILE

Convertir la aplicación en una PWA.

Implementar:

* manifest;
* iconos;
* instalación;
* responsive;
* mobile UX;
* cámara;
* micrófono;
* orientación.

Debe sentirse como una aplicación móvil.

---

FASE 15 — APK

Crear una APK Android instalable directamente.

Evaluar:

* Capacitor;
* Trusted Web Activity;
* wrapper nativo.

Elegir la solución que requiera menor mantenimiento.

La APK debe conectarse al backend online.

No depender de Play Store.

---

FASE 16 — AUDITORÍA FINAL

No agregar funcionalidades nuevas.

Auditar absolutamente todo:

* frontend;
* backend;
* WebRTC;
* signaling;
* salas;
* chat;
* cámara;
* micrófono;
* compartir pantalla;
* reconexión;
* seguridad;
* mobile;
* PWA;
* APK;
* performance.

Buscar específicamente:

* memory leaks;
* WebSocket leaks;
* RTCPeerConnection abiertas;
* MediaStreams no liberados;
* listeners duplicados;
* race conditions;
* errores de estado;
* errores de permisos;
* problemas de responsive;
* errores de compilación;
* dependencias innecesarias.

---

REGLA MÁS IMPORTANTE

TRABAJAR UNA SOLA FASE POR VEZ.

Después de terminar una fase:

1. Ejecutar pruebas.
2. Auditar lo implementado.
3. Confirmar que lo anterior continúa funcionando.
4. Mostrar archivos modificados.
5. Mostrar errores pendientes.
6. Explicar qué se hizo.
7. NO comenzar la siguiente fase.

Esperar exactamente mi autorización:

CONTINUAR

antes de avanzar.

Nunca implementar dos fases en una sola respuesta.

Si una fase encuentra problemas de una fase anterior, solucionar primero esos problemas.

==================================================
FORMATO OBLIGATORIO AL TERMINAR CADA FASE
=========================================

FASE COMPLETADA: X/16

### Objetivo

...

### Cambios realizados

...

### Archivos creados

...

### Archivos modificados

...

### Archivos eliminados

...

### Funcionalidades funcionando

...

### Pruebas realizadas

...

### Resultado

PASS / PASS CON OBSERVACIONES / BLOQUEADA

### Problemas encontrados

...

### Deuda técnica

...

### Siguiente fase

...

ESPERANDO "CONTINUAR"

==================================================

COMENZÁ AHORA.

ÚNICAMENTE FASE 1.

Primero inspeccioná el proyecto existente y auditá qué partes corresponden al concepto anterior de Omegle/matchmaking y cuáles pueden reutilizarse.

NO implementes todavía la Fase 2.
