interface CameraErrorScreenProps {
  message: string;
  onRetry: () => void;
}

/**
 * Pantalla de error de cámara/micrófono. Fase 3: `message` ya viene
 * del error real de getUserMedia (permiso denegado, dispositivo
 * inexistente, dispositivo en uso, navegador no soportado — ver
 * hooks/useLocalMedia.ts). "Reintentar" vuelve a pedir el permiso, no
 * solo navega a Home.
 */
export function CameraErrorScreen({ message, onRetry }: CameraErrorScreenProps) {
  return (
    <div className="screen screen--center">
      <span className="camera-error__icon" aria-hidden="true">
        🚫
      </span>
      <h2 className="camera-error__title">No pudimos acceder a tu cámara o micrófono</h2>
      <p className="home-hint">{message}</p>
      <button type="button" className="btn btn--primary btn--lg" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
