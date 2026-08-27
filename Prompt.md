# RVC V1 — PLAN MAESTRO DE IMPLEMENTACIÓN EN 16 FASES

## CONTEXTO ACTUAL

Este proyecto es una aplicación de videollamadas llamada RVC V1.

El proyecto originalmente utilizaba WebRTC P2P 1-a-1 mediante WebSocket propio.

La arquitectura futura definida es:

```text
Frontend
   │
   │ HTTPS
   ▼
Backend / API
   │
   │ LiveKit token
   ▼
LiveKit SFU
   │
   ├── Participante 1
   ├── Participante 2
   ├── Participante 3
   └── ... hasta 10
```

La arquitectura LiveKit ya fue decidida y existe un endpoint backend para emitir tokens.

IMPORTANTE:

El estado actual NO debe considerarse como una videollamada grupal terminada.

Actualmente:

* existe integración inicial de token LiveKit;
* existe `POST /livekit/token`;
* existe configuración inicial de `LIVEKIT_URL`, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET`;
* el proyecto todavía contiene partes del sistema P2P anterior;
* el cliente todavía necesita completar la migración real a LiveKit;
* el límite histórico era de 2 participantes;
* el sistema debe terminar soportando hasta 10 participantes;
* la interfaz debe representar múltiples participantes;
* el chat todavía no debe implementarse hasta llegar a su fase correspondiente.

---

# REGLAS ABSOLUTAS

## 1. AUDITAR ANTES DE PROGRAMAR

Antes de escribir una sola línea:

1. Leer `Prompt.md`.
2. Revisar la estructura completa del proyecto.
3. Revisar los archivos relacionados directamente con la fase.
4. Determinar qué ya existe.
5. Determinar qué está incompleto.
6. Determinar qué está roto.
7. Revisar las fases anteriores para evitar duplicar funcionalidad.

NO asumir que algo está terminado solamente porque existe un archivo o porque el nombre del ZIP indica una fase.

---

## 2. NO INVENTAR FUNCIONALIDAD

Una fase solamente puede declararse terminada si la funcionalidad realmente existe y fue comprobada.

NO declarar:

* "funcionando" si solamente compila;
* "LiveKit integrado" si el navegador todavía utiliza P2P;
* "10 participantes" si solamente existe una constante con valor 10;
* "chat funcionando" si solamente existe la interfaz;
* "grabación funcionando" si solamente existe un botón.

---

## 3. UNA SOLA FASE POR VEZ

Cuando yo diga:

`CONTINUAR`

debes ejecutar únicamente la siguiente fase pendiente.

NO avanzar dos fases juntas.

---

## 4. SI ENCUENTRAS UN PROBLEMA ANTERIOR

Si durante una fase descubres un problema de una fase anterior:

1. detener la fase actual;
2. corregir primero el problema anterior;
3. probar la corrección;
4. continuar solamente después de que quede estable.

---

## 5. NO TOCAR COSAS INNECESARIAS

No modificar archivos que no sean necesarios para la fase actual.

Evitar refactors grandes.

Priorizar:

* cambios pequeños;
* reversibles;
* verificables;
* fáciles de auditar.

---

## 6. DEPENDENCIAS

Antes de agregar una dependencia:

1. verificar si ya existe;
2. verificar si realmente es necesaria;
3. comprobar compatibilidad con el proyecto;
4. evitar duplicar librerías.

Si el entorno no permite instalar una dependencia, NO fingir que fue instalada.

Documentar el bloqueo.

---

## 7. TESTS

Al terminar cada fase ejecutar todas las comprobaciones disponibles y relevantes:

* TypeScript;
* build;
* tests;
* lint;
* tests manuales;
* smoke tests.

Si alguna prueba no puede ejecutarse, indicar exactamente por qué.

---

## 8. NO CAMBIAR LA UI POR ADELANTADO

No implementar funcionalidades de fases posteriores anticipadamente.

La interfaz puede recibir pequeños cambios necesarios para la fase actual, pero NO adelantar:

* chat;
* grabación;
* compartir pantalla;
* controles avanzados;
* estadísticas;
* autenticación avanzada;
* producción.

---

# NUEVA DIVISIÓN EN 16 FASES

---

# FASE 1 — PREPARACIÓN DEL CLIENTE LIVEKIT

Objetivo:

Preparar el frontend para utilizar LiveKit sin cambiar todavía el comportamiento completo de la llamada.

Tareas:

* verificar estrategia de carga de `livekit-client`;
* comprobar disponibilidad de la librería;
* crear una abstracción mínima para LiveKit;
* definir tipos necesarios;
* evitar dependencias directas dispersas por toda la aplicación;
* mantener el flujo P2P anterior intacto como fallback temporal si es necesario.

No implementar todavía:

* múltiples participantes;
* grid definitivo;
* chat;
* grabación.

Resultado esperado:

El proyecto debe poder acceder correctamente al SDK LiveKit desde el frontend.

---

# FASE 2 — CONEXIÓN BÁSICA AL LIVEKIT SFU

Objetivo:

Conseguir que un participante pueda conectarse realmente a una sala LiveKit.

Tareas:

* solicitar token al backend;
* recibir token;
* conectar al `Room`;
* manejar estados:

  * connecting;
  * connected;
  * disconnected;
  * reconnecting;
  * reconnected;
* cerrar correctamente la conexión;
* limpiar listeners.

Criterio de éxito:

Un navegador puede conectarse a una sala LiveKit real.

Todavía NO implementar múltiples participantes.

---

# FASE 3 — PUBLICACIÓN DE CÁMARA Y MICRÓFONO

Objetivo:

Publicar correctamente los dispositivos locales.

Tareas:

* solicitar cámara;
* solicitar micrófono;
* publicar video;
* publicar audio;
* detectar permisos denegados;
* detener tracks correctamente;
* manejar cámara/micrófono ausentes.

Criterio:

El participante aparece en LiveKit con sus tracks publicados.

---

# FASE 4 — RECEPCIÓN DE UN PARTICIPANTE REMOTO

Objetivo:

Completar el primer flujo real SFU 1-a-1.

Tareas:

* detectar participante remoto;
* detectar tracks publicados;
* suscribirse;
* renderizar video;
* reproducir audio;
* manejar unsubscribe;
* limpiar tracks cuando el participante se vaya.

Criterio:

Dos navegadores conectados a la misma sala pueden verse y escucharse mediante LiveKit.

IMPORTANTE:

Esto ya debe ser SFU real.

NO WebSocket P2P.

---

# FASE 5 — ELIMINACIÓN CONTROLADA DEL P2P

Objetivo:

Eliminar progresivamente el transporte P2P anterior.

Auditar:

* `useCallConnection.ts`;
* `room-sockets.ts`;
* `signaling.ts`;
* eventos offer/answer;
* ICE candidates;
* peer state;
* WebSocket de signaling.

Tareas:

* separar código legado;
* eliminar dependencias activas del P2P;
* conservar solamente lo que todavía sea utilizado por otras funcionalidades;
* evitar eliminar archivos sin comprobar referencias.

Criterio:

La llamada activa debe funcionar sin depender del signaling WebRTC P2P anterior.

---

# FASE 6 — MODELO DE PARTICIPANTES

Objetivo:

Pasar definitivamente de:

```text
localParticipant
remoteParticipant
```

a:

```text
participants[]
```

Tareas:

* crear modelo de participante;
* detectar join;
* detectar leave;
* actualizar estado;
* evitar duplicados;
* manejar reconexiones;
* mantener identidad estable.

Criterio:

La aplicación puede representar correctamente cualquier número de participantes recibidos por LiveKit.

---

# FASE 7 — LÍMITE REAL DE 10 PARTICIPANTES

Objetivo:

Implementar realmente el límite de 10.

Tareas:

* definir constante única;
* configurar límite en backend;
* configurar límite de sala LiveKit;
* validar capacidad antes de entrar;
* rechazar participante 11;
* devolver error controlado;
* mostrar estado apropiado.

Criterio:

Participantes 1–10 pueden entrar.

Participante 11 recibe rechazo controlado.

NO confiar solamente en el frontend.

---

# FASE 8 — GRID DE VIDEO MULTIPARTICIPANTE

Objetivo:

Crear el layout definitivo para 2–10 participantes.

Tareas:

* `ParticipantTile`;
* grid dinámico;
* 2 participantes;
* 3 participantes;
* 4 participantes;
* 5–6 participantes;
* 7–10 participantes;
* responsive desktop;
* responsive mobile;
* cámara apagada;
* avatar;
* nombre;
* estado de audio;
* estado de conexión.

Criterio:

La interfaz se adapta automáticamente al número real de participantes.

NO implementar chat todavía.

---

# FASE 9 — CICLO DE VIDA Y RECONEXIÓN

Objetivo:

Hacer robusta la llamada.

Tareas:

* pérdida temporal de conexión;
* reconnecting;
* reconnected;
* desconexión definitiva;
* participante que abandona;
* participante que vuelve;
* limpieza de tracks;
* cleanup al salir de la pantalla;
* evitar memory leaks;
* evitar listeners duplicados.

Criterio:

Entrar/salir/reconectar repetidamente no rompe la sala.

---

# FASE 10 — CONTROLES DE LLAMADA

Objetivo:

Completar los controles básicos.

Implementar correctamente:

* mute/unmute;
* cámara on/off;
* seleccionar dispositivo;
* cambiar cámara;
* cambiar micrófono;
* finalizar llamada.

Cada control debe modificar el estado real del track LiveKit.

NO crear controles visuales que no hagan nada.

Criterio:

Los controles afectan realmente la transmisión.

---

# FASE 11 — CHAT REALTIME

Objetivo:

Agregar chat para 2–10 participantes.

Usar preferentemente:

LiveKit Data Packets / Data Channels

si encajan correctamente con la arquitectura.

Alternativamente utilizar WebSocket backend solamente si existe una razón técnica clara.

Funciones:

* enviar mensaje;
* recibir mensaje;
* nombre del participante;
* timestamp;
* historial durante la sesión;
* mensajes del sistema;
* estado vacío;
* errores.

Criterio:

Todos los participantes de una sala reciben los mensajes.

---

# FASE 12 — COMPARTIR PANTALLA

Objetivo:

Agregar screen sharing.

Tareas:

* iniciar;
* detener;
* detectar cierre desde navegador;
* publicar track;
* mostrar track;
* distinguir pantalla de cámara;
* manejar mobile cuando no sea compatible.

Criterio:

El resto de participantes puede ver la pantalla compartida.

---

# FASE 13 — GRABACIÓN

Objetivo:

Preparar grabación server-side.

Utilizar:

LiveKit Egress

si la infraestructura elegida lo permite.

Tareas:

* iniciar grabación;
* detener grabación;
* permisos;
* estado;
* manejo de errores;
* almacenamiento;
* nombre de archivo;
* evitar grabaciones duplicadas.

NO almacenar secretos en frontend.

---

# FASE 14 — SEGURIDAD Y AUTORIZACIÓN

Objetivo:

Endurecer el sistema.

Auditar:

* generación de tokens;
* expiración;
* identidad;
* roomId;
* acceso a salas;
* abuso de endpoints;
* rate limiting;
* CORS;
* secretos;
* logs;
* validación de input;
* permisos de publicación;
* permisos de suscripción.

Criterio:

Un usuario no puede obtener acceso arbitrario a recursos que no le corresponden.

---

# FASE 15 — INFRAESTRUCTURA Y PRODUCCIÓN

Objetivo:

Preparar despliegue real.

Auditar:

* Render;
* frontend hosting;
* LiveKit Cloud o infraestructura propia;
* variables de entorno;
* HTTPS;
* WebSocket;
* TURN;
* ICE;
* dominios;
* logs;
* health checks;
* límites de recursos.

IMPORTANTE:

No asumir que Render Free es adecuado para SFU.

El SFU debe permanecer en infraestructura apropiada.

Criterio:

La arquitectura puede desplegarse sin depender de localhost.

---

# FASE 16 — AUDITORÍA FINAL Y RELEASE

Objetivo:

Auditar TODO el proyecto.

Revisar:

* funcionalidad;
* seguridad;
* performance;
* memoria;
* reconexión;
* 2 participantes;
* 3 participantes;
* 5 participantes;
* 10 participantes;
* participante 11;
* chat;
* cámara;
* micrófono;
* screen share;
* grabación;
* mobile;
* desktop;
* errores;
* logs;
* variables;
* documentación.

Crear:

```text
FINAL_AUDIT.md
```

Debe contener:

* funcionalidades implementadas;
* funcionalidades pendientes;
* bugs conocidos;
* deuda técnica;
* tests ejecutados;
* tests fallidos;
* infraestructura necesaria;
* instrucciones de deployment.

Solo después de esta fase considerar el proyecto como Release Candidate.

---

# FORMATO OBLIGATORIO AL TERMINAR CADA FASE

Después de ejecutar una fase, responder exactamente con:

## FASE X COMPLETADA

### Objetivo

Qué se buscaba conseguir.

### Auditoría previa

Qué encontraste antes de modificar.

### Cambios realizados

Lista exacta.

### Archivos creados

Lista.

### Archivos modificados

Lista.

### Archivos eliminados

Lista.

### Funcionalidades funcionando

Lista únicamente de cosas realmente verificadas.

### Pruebas realizadas

Indicar:

* PASS
* FAIL
* BLOCKED

y explicar cada una.

### Problemas encontrados

Lista de problemas reales.

### Deuda técnica

Solo lo que realmente queda pendiente.

### Resultado

Uno de:

* PASS
* PASS CON OBSERVACIONES
* BLOCKED
* FAIL

### Siguiente fase

Indicar cuál es la próxima fase, pero NO ejecutarla.

---

# REGLA FINAL

Después de terminar cada fase:

NO continuar automáticamente.

NO implementar la siguiente fase.

NO anticiparse.

Terminar siempre con:

**ESPERANDO "CONTINUAR"**

Cuando yo escriba:

`CONTINUAR`

recién entonces comenzarás la siguiente fase pendiente.

# PUNTO DE PARTIDA

El proyecto comienza este nuevo plan desde el estado actualmente existente:

* arquitectura LiveKit decidida;
* endpoint de token LiveKit existente;
* backend preparado parcialmente;
* P2P todavía presente;
* cliente LiveKit incompleto;
* máximo histórico de 2;
* UI grupal incompleta/no confiable;
* chat todavía inexistente.

Por lo tanto:

**La próxima tarea es FASE 1 — PREPARACIÓN DEL CLIENTE LIVEKIT.**

No saltar directamente a Fase 8.

No asumir que las fases anteriores están terminadas solamente por documentación o nombres de archivos.
