import { useEffect, useRef, useState } from "react";
import type { BoardItem } from "../livekit/types";
import { Icon } from "./Icon";

type BoardPosition = Pick<BoardItem, "x" | "y"> & Partial<Pick<BoardItem, "targetId" | "sourceId" | "targetX" | "targetY" | "width" | "height">>;
type ComposerKind = "text" | "link";

interface Props {
  items: BoardItem[];
  onAdd: (type: BoardItem["type"], content: string, position?: BoardPosition) => Promise<void>;
  onMove: (id: string, x: number, y: number) => Promise<void>;
  onResize: (id: string, width: number, height: number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUpload: (file: File, position?: BoardPosition) => Promise<void>;
}

export function CollaborativeBoard({ items, onAdd, onMove, onResize, onRemove, onUpload }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [menuPosition, setMenuPosition] = useState<BoardPosition | null>(null);
  const [composer, setComposer] = useState<{ type: ComposerKind; position: BoardPosition; value: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectFrom, setConnectFrom] = useState<BoardItem | null>(null);
  const [itemMenu, setItemMenu] = useState<{ item: BoardItem; position: BoardPosition } | null>(null);
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const boardShellRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const pendingImagePositionRef = useRef<BoardPosition | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveRef = useRef<{ id: string; startX: number; startY: number; startPointerX: number; startPointerY: number; width: number; height: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === boardShellRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement === boardShellRef.current) await document.exitFullscreen();
    else await boardShellRef.current?.requestFullscreen();
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const positionFromPoint = (clientX: number, clientY: number): BoardPosition | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const rawX = ((clientX - rect.left - viewport.x) / viewport.scale / rect.width) * 100;
    const rawY = ((clientY - rect.top - viewport.y) / viewport.scale / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(88, rawX)),
      y: Math.max(0, Math.min(84, rawY)),
    };
  };

  const openMenu = (clientX: number, clientY: number) => {
    const position = positionFromPoint(clientX, clientY);
    if (!position) return;
    clearLongPress();
    setComposer(null);
    setItemMenu(null);
    setMenuPosition(position);
  };

  const quickPosition = (): BoardPosition => {
    // Keep quick actions useful even after the user has panned or zoomed.
    // A small offset prevents successive items from being placed exactly on top
    // of each other.
    const offset = (items.length % 5) * 5;
    return { x: 32 + offset, y: 28 + offset };
  };

  const openQuickComposer = (type: ComposerKind) => {
    clearLongPress();
    setMenuPosition(null);
    setItemMenu(null);
    setComposer({ type, position: quickPosition(), value: "" });
  };

  const openUploadPicker = (type: "image" | "video", position = quickPosition()) => {
    pendingImagePositionRef.current = position;
    setMenuPosition(null);
    setComposer(null);
    uploadInputRef.current?.setAttribute("accept", type === "video" ? "video/mp4,video/webm,video/ogg" : "image/jpeg,image/png,image/webp,image/gif");
    uploadInputRef.current?.click();
  };

  const createItem = async () => {
    if (!composer?.value.trim() || isSaving) return;
    if (composer.type === "link") {
      try {
        new URL(composer.value.trim());
      } catch {
        setError("Ingresá un enlace completo y válido.");
        return;
      }
    }
    setIsSaving(true);
    try {
      await onAdd(composer.type, composer.value.trim(), composer.position);
      setComposer(null);
      setError(null);
    } catch {
      setError("No se pudo agregar el elemento. Intentá nuevamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const chooseAction = (action: "text" | "link" | "image" | "video") => {
    if (!menuPosition) return;
    if (action === "image" || action === "video") {
      openUploadPicker(action, menuPosition);
      return;
    }
    setComposer({ type: action, position: menuPosition, value: "" });
    setMenuPosition(null);
  };

  const openItemMenuAt = (x: number, y: number, item: BoardItem) => {
    const position = positionFromPoint(x, y);
    if (!position) return;
    setMenuPosition(null);
    setComposer(null);
    setItemMenu({ item, position });
  };

  const openItemMenu = (event: React.MouseEvent<HTMLElement>, item: BoardItem) => {
    event.preventDefault();
    event.stopPropagation();
    openItemMenuAt(event.clientX, event.clientY, item);
  };

  const pointForEvent = (event: React.MouseEvent<HTMLElement>): BoardPosition | null => {
    const position = positionFromPoint(event.clientX, event.clientY);
    if (!position) return null;
    const target = (event.target as HTMLElement).closest<HTMLElement>(".board-card[data-board-item-id]");
    const targetItem = target ? items.find((item) => item.id === target.dataset.boardItemId) : undefined;
    if (targetItem) return { x: targetItem.x + (targetItem.width ?? 18) / 2, y: targetItem.y + (targetItem.height ?? 16) / 2, targetId: targetItem.id };
    return position;
  };

  const itemSize = (item: BoardItem) => ({
    width: item.width ?? (item.type === "image" || item.type === "video" ? 20 : 18),
    height: item.height ?? (item.type === "image" || item.type === "video" ? 16 : 12),
  });

  const edgePoint = (item: BoardItem, towardX: number, towardY: number) => {
    const { width, height } = itemSize(item);
    const centerX = item.x + width / 2;
    const centerY = item.y + height / 2;
    const dx = towardX - centerX;
    const dy = towardY - centerY;
    if (dx === 0 && dy === 0) return { x: centerX, y: centerY };
    const scale = Math.min((width / 2) / Math.abs(dx || Number.EPSILON), (height / 2) / Math.abs(dy || Number.EPSILON));
    return { x: centerX + dx * scale, y: centerY + dy * scale };
  };

  const arrowPoints = (item: BoardItem) => {
    const target = item.targetId ? items.find((candidate) => candidate.id === item.targetId) : null;
    const source = item.sourceId ? items.find((candidate) => candidate.id === item.sourceId) : null;
    const sourceCenter = source ? { x: source.x + itemSize(source).width / 2, y: source.y + itemSize(source).height / 2 } : { x: item.x, y: item.y };
    const targetCenter = target ? { x: target.x + itemSize(target).width / 2, y: target.y + itemSize(target).height / 2 } : { x: item.targetX ?? item.x, y: item.targetY ?? item.y };
    const start = source ? edgePoint(source, targetCenter.x, targetCenter.y) : sourceCenter;
    const end = target ? edgePoint(target, sourceCenter.x, sourceCenter.y) : targetCenter;
    return { start, end };
  };

  const closeMenus = () => {
    setMenuPosition(null);
    setItemMenu(null);
    setComposer(null);
  };

  const connectToPoint = (event: React.MouseEvent<HTMLElement>) => {
    if (!connectFrom) return;
    event.preventDefault();
    event.stopPropagation();
    const target = pointForEvent(event);
    if (!target || target.targetId === connectFrom.id) return;
    void onAdd("arrow", "connection", { x: connectFrom.x, y: connectFrom.y, sourceId: connectFrom.id, targetId: target.targetId, targetX: target.x, targetY: target.y });
    setConnectFrom(null);
  };

  const resizeItem = (event: React.PointerEvent<HTMLButtonElement>, item: BoardItem) => {
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = item.width ?? 20;
    const startHeight = item.height ?? 18;
    const move = (moveEvent: PointerEvent) => void onResize(item.id, Math.max(10, Math.min(60, startWidth + ((moveEvent.clientX - startX) / ((boardRef.current?.clientWidth || 1) * viewport.scale)) * 100)), Math.max(10, Math.min(60, startHeight + ((moveEvent.clientY - startY) / ((boardRef.current?.clientHeight || 1) * viewport.scale)) * 100)));
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  const upload = async (file: File | undefined) => {
    const position = pendingImagePositionRef.current;
    pendingImagePositionRef.current = null;
    if (!file || !position || isSaving) return;
    setIsSaving(true);
    try {
      await onUpload(file, position);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo subir la imagen.");
    } finally {
      setIsSaving(false);
    }
  };

  const startDrag = (event: React.PointerEvent<HTMLElement>, item: BoardItem) => {
    const board = boardRef.current;
    const card = event.currentTarget;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    if (boardRect.width === 0 || boardRect.height === 0) return;
    moveRef.current = {
      id: item.id,
      startX: item.x,
      startY: item.y,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      width: cardRect.width,
      height: cardRect.height,
    };
    card.setPointerCapture(event.pointerId);
    card.classList.add("board-card--dragging");
    event.preventDefault();
  };

  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    clearLongPress();
    const moving = moveRef.current;
    const board = boardRef.current;
    event.currentTarget.classList.remove("board-card--dragging");
    if (!moving || !board) return;
    moveRef.current = null;
    const rect = board.getBoundingClientRect();
    const deltaX = event.clientX - moving.startPointerX;
    const deltaY = event.clientY - moving.startPointerY;
    const nextX = moving.startX + (deltaX / (rect.width * viewport.scale)) * 100;
    const nextY = moving.startY + (deltaY / (rect.height * viewport.scale)) * 100;
    void onMove(moving.id, Math.max(0, Math.min(88, nextX)), Math.max(0, Math.min(84, nextY)));
  };

  return (
    <section ref={boardShellRef} className="board" aria-label="Pizarrón colaborativo">
      <header className="board__header">
        <div>
          <p className="board__eyebrow">Espacio compartido</p>
          <h2>Pizarrón colaborativo</h2>
        </div>
        <div className="board__header-actions">
          <span className="board__count" aria-label={`${items.length} elementos`}>{items.length} {items.length === 1 ? "elemento" : "elementos"}</span>
          {document.fullscreenEnabled && <button type="button" className="board__fullscreen" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? "Salir de pantalla completa del pizarrón" : "Ver pizarrón en pantalla completa"}><Icon name={isFullscreen ? "shrink" : "expand"} size={16} /></button>}
        </div>
      </header>
      <div className="board__quick-actions" aria-label="Agregar contenido al pizarrón">
        <button type="button" onClick={() => openQuickComposer("text")}>+ Nota</button>
        <button type="button" onClick={() => openQuickComposer("link")}>+ Enlace</button>
        <button type="button" onClick={() => openUploadPicker("image")}>+ Foto</button>
        <button type="button" onClick={() => openUploadPicker("video")}>+ Video</button>
        {(viewport.scale !== 1 || viewport.x !== 0 || viewport.y !== 0) && <button type="button" className="board__reset-view" onClick={() => setViewport({ scale: 1, x: 0, y: 0 })}>Restablecer vista</button>}
      </div>
      <p className="board__hint">Usá los botones para agregar contenido. También podés hacer clic derecho, mantener presionado o arrastrar el lienzo.</p>
      {error && <p className="board__error" role="alert">{error}</p>}

      <input ref={uploadInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      <div
        ref={boardRef}
        className="board__canvas"
        onContextMenu={(event) => {
          if ((event.target as HTMLElement).closest(".board__context-menu, .board__composer")) return;
          const item = (event.target as HTMLElement).closest<HTMLElement>(".board-card[data-board-item-id]");
          if (item) { const boardItem = items.find((candidate) => candidate.id === item.dataset.boardItemId); if (boardItem) { openItemMenu(event, boardItem); return; } }
          event.preventDefault();
          setItemMenu(null);
          openMenu(event.clientX, event.clientY);
        }}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest(".board__context-menu, .board__composer, .board__item-menu")) return;
          if (connectFrom) connectToPoint(event);
          else closeMenus();
        }}
        onWheel={(event) => {
          event.preventDefault();
          setViewport((current) => ({ ...current, scale: Math.max(.65, Math.min(2.5, current.scale * (event.deltaY > 0 ? .92 : 1.08))) }));
        }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest(".board-card, .board__context-menu, .board__composer, .board__item-menu")) return;
          if (event.pointerType !== "touch") {
            panRef.current = { startX: event.clientX, startY: event.clientY, x: viewport.x, y: viewport.y };
            boardRef.current?.setPointerCapture(event.pointerId);
            return;
          }
          clearLongPress();
          longPressTimerRef.current = setTimeout(() => openMenu(event.clientX, event.clientY), 550);
        }}
        onPointerMove={(event) => {
          clearLongPress();
          if (panRef.current) setViewport((current) => ({ ...current, x: panRef.current!.x + event.clientX - panRef.current!.startX, y: panRef.current!.y + event.clientY - panRef.current!.startY }));
        }}
        onPointerUp={() => { clearLongPress(); panRef.current = null; }}
        onPointerCancel={() => { clearLongPress(); panRef.current = null; }}
      >
        <div className="board__surface" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
        {items.length === 0 && <p className="board__empty">Elegí un punto del pizarrón y usá el menú contextual para crear la primera idea.</p>}

        {menuPosition && (
          <div className="board__context-menu" style={{ left: `${menuPosition.x}%`, top: `${menuPosition.y}%` }} role="menu" aria-label="Agregar al pizarrón">
            <p>Agregar aquí</p>
            <button type="button" role="menuitem" onClick={() => chooseAction("text")}>Nota</button>
            <button type="button" role="menuitem" onClick={() => chooseAction("link")}>Enlace</button>
            <button type="button" role="menuitem" onClick={() => chooseAction("image")}>Fotos</button>
            <button type="button" role="menuitem" onClick={() => chooseAction("video")}>Videos</button>
          </div>
        )}

        {itemMenu && (
          <div className="board__item-menu" style={{ left: `${itemMenu.position.x}%`, top: `${itemMenu.position.y}%` }} role="menu" aria-label={`Acciones para ${itemMenu.item.type}`}>
            <button type="button" role="menuitem" onClick={() => { setConnectFrom(itemMenu.item); setItemMenu(null); }}>Unir con</button>
            <button type="button" role="menuitem" onClick={() => setItemMenu(null)}>Cancelar</button>
          </div>
        )}

        {composer && (
          <form className="board__composer" style={{ left: `${composer.position.x}%`, top: `${composer.position.y}%` }} onSubmit={(event) => { event.preventDefault(); void createItem(); }}>
            <label htmlFor="board-context-value">{composer.type === "text" ? "Nueva nota" : "Nuevo enlace"}</label>
            <input id="board-context-value" autoFocus value={composer.value} onChange={(event) => setComposer((current) => current ? { ...current, value: event.target.value } : null)} placeholder={composer.type === "text" ? "Escribí una idea…" : "https://…"} inputMode={composer.type === "link" ? "url" : "text"} maxLength={composer.type === "text" ? 500 : undefined} />
            <div><button type="button" className="btn btn--ghost" onClick={() => setComposer(null)}>Cancelar</button><button type="submit" className="btn btn--primary" disabled={!composer.value.trim() || isSaving}>{isSaving ? "Creando…" : "Crear"}</button></div>
          </form>
        )}

        {items.map((item) => (
          item.type === "arrow" ? <svg key={item.id} className="board-arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Flecha de conexión"><defs><marker id={`arrow-${item.id}`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" /></marker></defs><line x1={arrowPoints(item).start.x} y1={arrowPoints(item).start.y} x2={arrowPoints(item).end.x} y2={arrowPoints(item).end.y} markerEnd={`url(#arrow-${item.id})`} /></svg> : <article key={item.id} data-board-item-id={item.id} className={`board-card board-card--${item.type}`} style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.width ?? (item.type === "image" || item.type === "video" ? 20 : 18)}%`, minHeight: `${item.height ?? (item.type === "image" || item.type === "video" ? 16 : 0)}%` }} onPointerDown={(event) => {
            if (event.pointerType === "touch") {
              clearLongPress();
              longPressTimerRef.current = setTimeout(() => openItemMenuAt(event.clientX, event.clientY, item), 550);
              return;
            }
            startDrag(event, item);
          }} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
            <span className="board-card__handle" aria-hidden="true">⠿</span>
            <button type="button" className="board-card__remove" aria-label="Eliminar elemento" onPointerDown={(event) => event.stopPropagation()} onClick={() => void onRemove(item.id)}><Icon name="trash" size={15} /></button>
            {item.type === "image" ? <img src={item.content} alt="Imagen del pizarrón" draggable={false} /> : item.type === "video" ? <video src={item.content} controls preload="metadata" /> : item.type === "link" ? <a href={item.content} target="_blank" rel="noreferrer"><strong>{new URL(item.content).hostname}</strong><span>{item.content}</span></a> : <p>{item.content}</p>}
            {(item.type === "image" || item.type === "video") && <button type="button" className="board-card__resize" aria-label="Cambiar tamaño" onPointerDown={(event) => resizeItem(event, item)} />}
          </article>
        ))}
        </div>
      </div>
    </section>
  );
}
