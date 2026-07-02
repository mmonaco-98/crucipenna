import { useCallback, useEffect, useRef } from "react";
import type { PuzzleData } from "../../types/puzzle";

const COMMIT_DELAY_MS = 200;

interface GridPenOverlayProps {
  puzzle: PuzzleData;
  penEnabled: boolean;
  onCellSelect: (row: number, col: number, allowToggle?: boolean) => void;
  onPenStroke: (dataUrl: string, row: number, col: number) => Promise<void>;
}

export function GridPenOverlay({
  puzzle,
  penEnabled,
  onCellSelect,
  onPenStroke,
}: GridPenOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef({
    drawing: false,
    row: 0,
    col: 0,
    cellRect: null as DOMRect | null,
    hasStroke: false,
    canvasRect: null as DOMRect | null,
    // tracks the cell for the current multi-stroke window
    windowRow: -1,
    windowCol: -1,
  });

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 280;
    canvas.height = 280;
    offscreenRef.current = canvas;
  }, []);

  // Keep canvas internal resolution in sync with its CSS size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = Math.round(rect.width);
        canvas.height = Math.round(rect.height);
        stateRef.current.canvasRect = rect;
      }
    };

    const observer = new ResizeObserver(syncSize);
    observer.observe(canvas);
    syncSize(); // initial sync
    return () => observer.disconnect();
  }, []);

  const clearOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const clearOffscreen = useCallback(() => {
    const canvas = offscreenRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const cancelCommitTimer = useCallback(() => {
    if (commitTimerRef.current !== null) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  // Commits the current window: sends offscreen data, clears visuals, resets window state
  const commitStroke = useCallback(async () => {
    cancelCommitTimer();
    const state = stateRef.current;
    if (!state.hasStroke || !offscreenRef.current) return;
    const dataUrl = offscreenRef.current.toDataURL("image/png");
    const row = state.windowRow;
    const col = state.windowCol;
    state.hasStroke = false;
    state.windowRow = -1;
    state.windowCol = -1;
    clearOverlay();
    clearOffscreen();
    await onPenStroke(dataUrl, row, col);
  }, [cancelCommitTimer, clearOffscreen, clearOverlay, onPenStroke]);

  const scheduleCommit = useCallback(() => {
    cancelCommitTimer();
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      void commitStroke();
    }, COMMIT_DELAY_MS);
  }, [cancelCommitTimer, commitStroke]);

  // Clean up timer on unmount
  useEffect(() => () => cancelCommitTimer(), [cancelCommitTimer]);

  const findCellAt = useCallback(
    (clientX: number, clientY: number) => {
      const elements = document.elementsFromPoint(clientX, clientY);
      for (const el of elements) {
        const rowAttr = (el as HTMLElement).dataset?.row;
        const colAttr = (el as HTMLElement).dataset?.col;
        if (rowAttr !== undefined && colAttr !== undefined) {
          const row = parseInt(rowAttr, 10);
          const col = parseInt(colAttr, 10);
          if (puzzle.grid[row]?.[col] !== "#") {
            return { row, col, rect: el.getBoundingClientRect() };
          }
        }
      }
      return null;
    },
    [puzzle.grid],
  );

  const toOverlayCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = stateRef.current.canvasRect ?? canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const toOffscreenCoords = (clientX: number, clientY: number) => {
    const cellRect = stateRef.current.cellRect;
    if (!cellRect) return { x: 140, y: 140 };
    return {
      x: ((clientX - cellRect.left) / cellRect.width) * 280,
      y: ((clientY - cellRect.top) / cellRect.height) * 280,
    };
  };

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const cell = findCellAt(event.clientX, event.clientY);
      if (!cell) return;

      // When pen mode is enabled, reject large contact areas (likely palm)
      // but allow small touches (likely finger) and pen inputs
      if (penEnabled && event.pointerType === "touch") {
        if (event.width > 100 || event.height > 100) {
          return; // Large contact area: likely palm, ignore
        }
      }

      // Pen input: select the cell but don't toggle direction
      const allowToggle = event.pointerType !== "pen";
      onCellSelect(cell.row, cell.col, allowToggle);

      if (event.pointerType !== "pen" || !penEnabled) return;

      event.currentTarget.setPointerCapture(event.pointerId);

      const state = stateRef.current;
      const sameWindow =
        commitTimerRef.current !== null &&
        state.windowRow === cell.row &&
        state.windowCol === cell.col;

      if (!sameWindow) {
        // Different cell or no active window: commit any pending stroke and start fresh
        cancelCommitTimer();
        if (state.hasStroke && state.windowRow >= 0) {
          // There was a pending stroke for a different cell — discard it
          state.hasStroke = false;
          clearOverlay();
          clearOffscreen();
        } else {
          clearOverlay();
          clearOffscreen();
        }
        state.windowRow = cell.row;
        state.windowCol = cell.col;
      } else {
        // Continuing in the same window: cancel pending timer, keep existing strokes
        cancelCommitTimer();
      }

      state.drawing = true;
      state.row = cell.row;
      state.col = cell.col;
      state.cellRect = cell.rect;
      state.canvasRect = canvasRef.current?.getBoundingClientRect() ?? null;

      const { x: ox, y: oy } = toOverlayCoords(event.clientX, event.clientY);
      const { x: sx, y: sy } = toOffscreenCoords(event.clientX, event.clientY);

      const overlayCtx = canvasRef.current?.getContext("2d");
      if (overlayCtx) {
        overlayCtx.lineCap = "round";
        overlayCtx.lineJoin = "round";
        overlayCtx.lineWidth = 2;
        overlayCtx.strokeStyle = "#1a6ef5cc";
        overlayCtx.beginPath();
        overlayCtx.moveTo(ox, oy);
      }

      const offCtx = offscreenRef.current?.getContext("2d");
      if (offCtx) {
        offCtx.lineCap = "round";
        offCtx.lineJoin = "round";
        offCtx.lineWidth = 24;
        offCtx.strokeStyle = "#111";
        offCtx.beginPath();
        offCtx.moveTo(sx, sy);
      }
    },
    [
      findCellAt,
      onCellSelect,
      penEnabled,
      cancelCommitTimer,
      clearOffscreen,
      clearOverlay,
    ],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const state = stateRef.current;
      if (!state.drawing || event.pointerType !== "pen") return;

      state.hasStroke = true;

      const { x: ox, y: oy } = toOverlayCoords(event.clientX, event.clientY);
      const { x: sx, y: sy } = toOffscreenCoords(event.clientX, event.clientY);

      const overlayCtx = canvasRef.current?.getContext("2d");
      if (overlayCtx) {
        overlayCtx.lineTo(ox, oy);
        overlayCtx.stroke();
        overlayCtx.beginPath();
        overlayCtx.moveTo(ox, oy);
      }

      const offCtx = offscreenRef.current?.getContext("2d");
      if (offCtx) {
        offCtx.lineTo(sx, sy);
        offCtx.stroke();
        offCtx.beginPath();
        offCtx.moveTo(sx, sy);
      }
    },
    [],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const state = stateRef.current;
      if (!state.drawing || event.pointerType !== "pen") return;

      state.drawing = false;

      if (state.hasStroke) {
        scheduleCommit();
      }
    },
    [scheduleCommit],
  );

  const handlePointerCancel = useCallback(() => {
    stateRef.current.drawing = false;
    cancelCommitTimer();
    clearOverlay();
  }, [cancelCommitTimer, clearOverlay]);

  return (
    <canvas
      ref={canvasRef}
      className="gridPenOverlay"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}
