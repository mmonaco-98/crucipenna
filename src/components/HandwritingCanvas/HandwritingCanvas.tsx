import { useCallback, useEffect, useRef, useState } from "react";
import type { PenTarget } from "../../types/puzzle";

const COMMIT_DELAY_MS = 200;

interface HandwritingCanvasProps {
  penTarget: PenTarget | null;
  onClose: () => void;
  onRecognize: (dataUrl: string) => Promise<void>;
}

export function HandwritingCanvas({
  penTarget,
  onClose,
  onRecognize,
}: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs keep always-current values inside setTimeout callbacks (no stale closure)
  const hasStrokeRef = useRef(false);
  const busyRef = useRef(false);
  const drawingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 16;
    context.strokeStyle = "#2563eb";
    return context;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = getContext();
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    hasStrokeRef.current = false;
    setHasStroke(false);
  }, [getContext]);

  const cancelCommitTimer = useCallback(() => {
    if (commitTimerRef.current !== null) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  // runRecognition reads from refs so it's always current even inside setTimeout
  const runRecognition = useCallback(async () => {
    cancelCommitTimer();
    if (!hasStrokeRef.current || busyRef.current || !canvasRef.current) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    try {
      await onRecognize(canvasRef.current.toDataURL("image/png"));
      clearCanvas();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [cancelCommitTimer, clearCanvas, onRecognize]);

  const scheduleCommit = useCallback(() => {
    cancelCommitTimer();
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      void runRecognition();
    }, COMMIT_DELAY_MS);
  }, [cancelCommitTimer, runRecognition]);

  useEffect(() => {
    if (!penTarget) {
      cancelCommitTimer();
      return;
    }
    clearCanvas();
  }, [cancelCommitTimer, clearCanvas, penTarget]);

  // Clean up timer on unmount
  useEffect(() => () => cancelCommitTimer(), [cancelCommitTimer]);

  if (!penTarget) {
    return null;
  }

  const drawStart = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // Cancel any pending commit when a new stroke begins
    cancelCommitTimer();
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = getContext();
    if (!context) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    context.beginPath();
    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    drawingRef.current = true;
    hasStrokeRef.current = true;
    setHasStroke(true);
  };

  const drawMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) {
      return;
    }

    const context = getContext();
    if (!context) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
  };

  const drawEnd = () => {
    drawingRef.current = false;
    scheduleCommit();
  };

  return (
    <div className="canvasOverlay">
      <div className="canvasPanel">
        <h3>
          Scrivi nella casella {penTarget.row + 1},{penTarget.col + 1}
        </h3>
        <canvas
          ref={canvasRef}
          className="drawCanvas"
          width={320}
          height={320}
          onPointerDown={drawStart}
          onPointerMove={drawMove}
          onPointerUp={drawEnd}
          onPointerCancel={() => {
            drawingRef.current = false;
            cancelCommitTimer();
          }}
        />
        <div className="canvasActions">
          <button type="button" onClick={clearCanvas}>
            Pulisci
          </button>
          <button
            type="button"
            onClick={runRecognition}
            disabled={!hasStroke || busy}
          >
            {busy ? "Analisi..." : "Riconosci"}
          </button>
          <button type="button" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
