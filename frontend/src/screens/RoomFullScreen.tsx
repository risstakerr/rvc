interface RoomFullScreenProps {
  onCreateNew: () => void;
}

/**
 * La sala existe pero ya tiene 2 participantes conectados por
 * WebSocket cuando intentamos unirnos (backend de la Fase 5, mensaje
 * `room-full`). Distinta de "room-not-found": acá la sala es válida,
 * simplemente ya está completa. Mensaje literal pedido en el prompt.
 */
export function RoomFullScreen({ onCreateNew }: RoomFullScreenProps) {
  return (
    <div className="screen screen--center">
      <span className="camera-error__icon" aria-hidden="true">
        🚫
      </span>
      <h2 className="camera-error__title">Esta llamada ya está completa.</h2>
      <p className="home-hint">Esta sala privada ya tiene dos personas conectadas.</p>
      <button type="button" className="btn btn--primary btn--lg" onClick={onCreateNew}>
        Crear una nueva llamada
      </button>
    </div>
  );
}
