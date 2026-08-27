/**
 * Se muestra brevemente cuando alguien abre un enlace `/call/:roomId`
 * directamente, mientras el frontend le pregunta al backend si esa
 * sala todavía existe (ver api/rooms.ts).
 */
export function CheckingRoomScreen() {
  return (
    <div className="screen screen--center">
      <div className="search-spinner" role="status" aria-live="polite">
        <span className="search-spinner__ring" aria-hidden="true" />
        <p className="search-spinner__text">Verificando la sala…</p>
      </div>
    </div>
  );
}
