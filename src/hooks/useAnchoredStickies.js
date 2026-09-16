import { useSyncExternalStore } from "react";
import {
  anchoredStore,
  currentViewport,
  moveAnchor,
  resizeAnchor,
  toggleMinimize as toggleMinimizeAnchor,
  bringToFront,
} from "@/lib/anchoredStickies";

const applyMove = (stickyId, { x, y }) => anchoredStore.update(stickyId, (a, vp) => moveAnchor(a, { x, y }, vp), currentViewport());
const applyResize = (stickyId, { width, height }) =>
  anchoredStore.update(stickyId, (a, vp) => resizeAnchor(a, { width, height }, vp), currentViewport());

export default function useAnchoredStickies() {
  const anchors = useSyncExternalStore(anchoredStore.subscribe, anchoredStore.getSnapshot, () => []);

  const anchorSticky = (stickyId) => anchoredStore.pin(stickyId, currentViewport());
  const unanchorSticky = (stickyId) => anchoredStore.unpin(stickyId);
  const toggleMinimize = (stickyId) => anchoredStore.update(stickyId, (a, vp) => toggleMinimizeAnchor(a, vp), currentViewport());
  const bringToFrontOf = (stickyId) => anchoredStore.setAnchors(bringToFront(anchors, stickyId), currentViewport());
  const moveSticky = (id, pos) => applyMove(id, pos);
  const resizeSticky = (id, size) => applyResize(id, size);

  return { anchors, anchorSticky, unanchorSticky, toggleMinimize, bringToFrontOf, moveSticky, resizeSticky };
}