import { useCallback, useEffect, useRef, useState } from "react";
import type { PenTarget } from "../../types/puzzle";

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
  const [drawing, setDrawing] = useState(false);
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
    context.strokeStyle = "#111";
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
    setHasStroke(false);
  }, [getContext]);

  useEffect(() => {
    if (!penTarget) {
      return;
    }
    clearCanvas();
  }, [clearCanvas, penTarget]);

  if (!penTarget) {
    return null;
  }

  const drawStart = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = getContext();
    if (!context) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    context.beginPath();
    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    setDrawing(true);
    setHasStroke(true);
  };

  const drawMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) {
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

  const runRecognition = async () => {
    if (!hasStroke || busy || !canvasRef.current) {
      return;
    }

    setBusy(true);
    try {
      await onRecognize(canvasRef.current.toDataURL("image/png"));
      clearCanvas();
    } finally {
      setBusy(false);
    }
  };

  const drawEnd = async () => {
    setDrawing(false);
    await runRecognition();
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
            setDrawing(false);
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
