/**
 * Servidores ICE para el establecimiento de la conexión WebRTC P2P.
 *
 * Por ahora solo STUN público (necesario para que cada navegador
 * descubra su dirección pública y la conexión directa funcione
 * detrás de NAT). Sin STUN, dos navegadores en redes distintas
 * prácticamente nunca podrían conectarse directamente.
 *
 * TURN (relay para cuando la conexión P2P directa no es posible) es
 * la Fase 13 del prompt: ahí se agrega, configurable por variables de
 * entorno, sin depender de un servicio pago obligatorio. Esta lista
 * está aislada en su propio módulo para que la Fase 13 la reemplace
 * sin tocar la lógica de `useCallConnection`.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];
