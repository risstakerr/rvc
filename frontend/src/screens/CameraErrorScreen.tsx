interface CameraErrorScreenProps {
  message: string;
  onRetry: () => void;
}
import { Icon } from "../components/Icon";

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
      <span className="feedback-icon feedback-icon--danger" aria-hidden="true"><Icon name="camera-off" size={30} /></span>
      <h2 className="camera-error__title">No pudimos acceder a tu cámara o micrófono</h2>
      <p className="home-hint">{message}</p>
      <button type="button" className="btn btn--primary btn--lg" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
