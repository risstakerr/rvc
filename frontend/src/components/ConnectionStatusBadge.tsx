import type { ConnectionState } from "@pvc/shared";

/**
 * Indicador visual del estado de conexión. `ConnectionState` viene
 * del paquete `shared`, para que frontend y backend compartan el
 * mismo contrato (Fase 2: ya conectado como workspace real de npm).
 */
const LABELS: Record<ConnectionState, string> = {
  IDLE: "Inactivo",
  WAITING_FOR_PEER: "Esperando a la otra persona",
  CONNECTING: "Conectando",
  CONNECTED: "Conectado",
  RECONNECTING: "Reconectando",
  DISCONNECTED: "Desconectado",
};

const TONE: Record<ConnectionState, "neutral" | "warning" | "success" | "danger"> = {
  IDLE: "neutral",
  WAITING_FOR_PEER: "warning",
  CONNECTING: "warning",
  CONNECTED: "success",
  RECONNECTING: "warning",
  DISCONNECTED: "danger",
};

export function ConnectionStatusBadge({ state }: { state: ConnectionState }) {
  const tone = TONE[state];
  const isBusy = state === "WAITING_FOR_PEER" || state === "CONNECTING" || state === "RECONNECTING";

  return (
    <span className={`status-badge status-badge--${tone}`}>
      <span className={`status-dot${isBusy ? " status-dot--pulse" : ""}`} aria-hidden="true" />
      {LABELS[state]}
    </span>
  );
}
