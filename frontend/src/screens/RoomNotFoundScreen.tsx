interface RoomNotFoundScreenProps {
  onCreateNew: () => void;
}

/**
 * El roomId de la URL no existe (nunca se creó, expiró, o el enlace
 * está mal escrito). Distinta del mensaje "Esta llamada ya está
 * completa" (Fase 5, cuando la sala existe pero ya tiene 2 personas).
 */
export function RoomNotFoundScreen({ onCreateNew }: RoomNotFoundScreenProps) {
  return (
    <div className="screen screen--center">
      <span className="camera-error__icon" aria-hidden="true">
        🔗
      </span>
      <h2 className="camera-error__title">Esta llamada ya no está disponible</h2>
      <p className="home-hint">El enlace puede haber expirado, o la sala nunca existió.</p>
      <button type="button" className="btn btn--primary btn--lg" onClick={onCreateNew}>
        Crear una nueva llamada
      </button>
    </div>
  );
}
