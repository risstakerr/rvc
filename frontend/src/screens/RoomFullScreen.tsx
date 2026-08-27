import { MAX_ROOM_PARTICIPANTS } from "@pvc/shared";
import { Icon } from "../components/Icon";

interface RoomFullScreenProps {
  onCreateNew: () => void;
}

/** Rechazo controlado cuando el backend informa que la sala llegó a su capacidad. */
export function RoomFullScreen({ onCreateNew }: RoomFullScreenProps) {
  return (
    <div className="screen screen--center">
      <span className="feedback-icon feedback-icon--warning" aria-hidden="true"><Icon name="users" size={30} /></span>
      <h2 className="camera-error__title">Esta sala está completa</h2>
      <p className="home-hint">La llamada admite hasta {MAX_ROOM_PARTICIPANTS} participantes simultáneos.</p>
      <button type="button" className="btn btn--primary btn--lg" onClick={onCreateNew}>
        Crear una nueva llamada
      </button>
    </div>
  );
}
