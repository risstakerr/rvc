interface RoomNotFoundScreenProps {
  onCreateNew: () => void;
}
import { Icon } from "../components/Icon";

/**
 * El roomId de la URL no existe (nunca se creó, expiró, o el enlace
 * está mal escrito). Distinta del mensaje de capacidad completa.
 */
export function RoomNotFoundScreen({ onCreateNew }: RoomNotFoundScreenProps) {
  return (
    <div className="screen screen--center">
      <span className="feedback-icon feedback-icon--danger" aria-hidden="true"><Icon name="link-off" size={30} /></span>
      <h2 className="camera-error__title">Esta llamada ya no está disponible</h2>
      <p className="home-hint">El enlace puede haber expirado, o la sala nunca existió.</p>
      <button type="button" className="btn btn--primary btn--lg" onClick={onCreateNew}>
        Crear una nueva llamada
      </button>
    </div>
  );
}
