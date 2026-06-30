import { useCallback, useEffect, useRef } from "react";
import type { PuzzleData } from "../../types/puzzle";

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
  const stateRef = useRef({
    drawing: false,
    row: 0,
    col: 0,
    cellRect: null as DOMRect | null,
    hasStroke: false,
    canvasRect: null as DOMRect | null,
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
      clearOffscreen();
      clearOverlay();

      const state = stateRef.current;
      state.drawing = true;
      state.row = cell.row;
      state.col = cell.col;
      state.cellRect = cell.rect;
      state.hasStroke = false;
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
    [findCellAt, onCellSelect, penEnabled, clearOffscreen, clearOverlay],
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
    async (event: React.PointerEvent<HTMLCanvasElement>) => {
      const state = stateRef.current;
      if (!state.drawing || event.pointerType !== "pen") return;

      state.drawing = false;
      clearOverlay();

      if (state.hasStroke && offscreenRef.current) {
        const dataUrl = offscreenRef.current.toDataURL("image/png");
        await onPenStroke(dataUrl, state.row, state.col);
      }
    },
    [clearOverlay, onPenStroke],
  );

  const handlePointerCancel = useCallback(() => {
    stateRef.current.drawing = false;
    clearOverlay();
  }, [clearOverlay]);

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
