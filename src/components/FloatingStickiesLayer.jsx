import { useMemo, useRef, useCallback } from "react";
import { X, Minus, GripVertical } from "lucide-react";
import { useUserData } from "@/lib/useUserData";
import useAnchoredStickies from "@/hooks/useAnchoredStickies";
import { STICKY_BG } from "@/components/stickies/stickyColors";

const DragBar = ({ note, pin, bringToFrontOf, moveSticky }) => {
  const drag = useRef(null);
  const handlePointerDown = useCallback(
    (e) => {
      bringToFrontOf(note.id);
      drag.current = { px: e.clientX, py: e.clientY, ox: pin.x, oy: pin.y };
      const onMove = (ev) => {
        if (!drag.current) return;
        const { px, py, ox, oy } = drag.current;
        moveSticky(note.id, { x: ox + (ev.clientX - px), y: oy + (ev.clientY - py) });
      };
      const onUp = () => {
        drag.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      e.preventDefault();
    },
    [note.id, pin.x, pin.y, bringToFrontOf, moveSticky]
  );
  return (
    <button
      aria-label="Drag note"
      onPointerDown={handlePointerDown}
      className="flex items-center justify-center w-full cursor-grab active:cursor-grabbing touch-none opacity-70 hover:opacity-100"
    >
      <GripVertical className="w-3 h-3" />
    </button>
  );
};

const ResizeHandle = ({ note, pin, resizeSticky }) => {
  const drag = useRef(null);
  const handlePointerDown = useCallback(
    (e) => {
      drag.current = { px: e.clientX, py: e.clientY, w: pin.width, h: pin.height };
      const onMove = (ev) => {
        if (!drag.current) return;
        const { px, py, w, h } = drag.current;
        resizeSticky(note.id, { width: w + (ev.clientX - px), height: h + (ev.clientY - py) });
      };
      const onUp = () => {
        drag.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      e.preventDefault();
    },
    [note.id, pin.width, pin.height, resizeSticky]
  );
  return (
    <button
      aria-label="Resize note"
      onPointerDown={handlePointerDown}
      className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize touch-none opacity-50 hover:opacity-100"
    />
  );
};

const PinnedChip = ({ note, pin, toggleMinimize, unanchorSticky, bringToFrontOf, moveSticky }) => {
  const drag = useRef(null);
  const handlePointerDown = useCallback(
    (e) => {
      bringToFrontOf(note.id);
      drag.current = { px: e.clientX, py: e.clientY, ox: pin.x, oy: pin.y };
      const onMove = (ev) => {
        if (!drag.current) return;
        const { px, py, ox, oy } = drag.current;
        moveSticky(note.id, { x: ox + (ev.clientX - px), y: oy + (ev.clientY - py) });
      };
      const onUp = () => {
        drag.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      e.preventDefault();
    },
    [note.id, pin.x, pin.y, bringToFrontOf, moveSticky]
  );
  return (
    <div
      style={{ left: pin.x, top: pin.y, width: pin.width, height: pin.height, zIndex: pin.z }}
      className={`absolute flex flex-col items-center justify-center gap-1 rounded-full px-3 shadow-lg shadow-black/30 ${STICKY_BG[note.color] || STICKY_BG.amber}`}
    >
      <button
        aria-label="Expand note"
        onPointerDown={(e) => { e.stopPropagation(); bringToFrontOf(note.id); toggleMinimize(note.id); }}
        className="text-[11px] font-medium leading-tight truncate max-w-[120px] pointer-events-auto touch-none"
      >
        {note.content?.slice(0, 40) || "Note"}
      </button>
      <div className="flex items-center gap-2 pointer-events-auto touch-none" onPointerDown={(e) => e.stopPropagation()}>
        <button aria-label="Move note" onPointerDown={handlePointerDown} className="p-0.5 opacity-60 hover:opacity-100"><GripVertical className="w-3 h-3" /></button>
        <button aria-label="Remove from screen" onClick={() => unanchorSticky(note.id)} className="p-0.5 opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
      </div>
    </div>
  );
};

export default function FloatingStickiesLayer() {
  const { data } = useUserData();
  const { anchors, unanchorSticky, toggleMinimize, bringToFrontOf, moveSticky, resizeSticky } = useAnchoredStickies();
  const notesById = useMemo(() => {
    const m = new Map();
    (data?.StickyNote || []).forEach((n) => m.set(n.id, n));
    return m;
  }, [data?.StickyNote]);

  const visible = useMemo(() => anchors.map((a) => ({ anchor: a, note: notesById.get(a.stickyId) })).filter(({ note }) => !!note), [anchors, notesById]);
  if (!visible.length) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none" aria-label="Pinned notes">
      {visible.map(({ anchor, note }) =>
        anchor.minimized ? (
          <div key={note.id} style={{ left: anchor.x, top: anchor.y, zIndex: anchor.z }} className="absolute pointer-events-auto">
            <PinnedChip note={note} pin={anchor} toggleMinimize={toggleMinimize} unanchorSticky={unanchorSticky} bringToFrontOf={bringToFrontOf} moveSticky={moveSticky} />
          </div>
        ) : (
          <div
            key={note.id}
            onPointerDown={() => bringToFrontOf(note.id)}
            style={{ left: anchor.x, top: anchor.y, width: anchor.width, height: anchor.height, zIndex: anchor.z }}
            className={`absolute pointer-events-auto flex flex-col rounded-xl shadow-xl shadow-black/30 overflow-hidden resize-none select-none ${STICKY_BG[note.color] || STICKY_BG.amber}`}
          >
            <DragBar note={note} pin={anchor} bringToFrontOf={bringToFrontOf} moveSticky={moveSticky} />

            <p className="flex-1 overflow-hidden px-3 pb-2 pt-0.5 font-sticky text-base leading-snug whitespace-pre-wrap break-words cursor-default">
              {note.content}
            </p>

            <div className="flex items-center justify-end gap-1 px-2 pb-1.5 pointer-events-auto">
              <button aria-label="Minimize to corner" onClick={() => toggleMinimize(note.id)} className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-black/10">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button aria-label="Remove from screen" onClick={() => unanchorSticky(note.id)} className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-black/10">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <ResizeHandle note={note} pin={anchor} resizeSticky={resizeSticky} />
          </div>
        )
      )}
    </div>
  );
}