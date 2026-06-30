import { useEffect, useState } from "react";
import type { LayersModel, Tensor } from "@tensorflow/tfjs";

interface UseHandwritingRecognition {
  loading: boolean;
  modelReady: boolean;
  modelError: string | null;
  predictFromCanvas: (dataUrl: string) => Promise<string | null>;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const imageFromDataUrl = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossibile leggere il disegno"));
    image.src = dataUrl;
  });

export const useHandwritingRecognition = (
  modelPath: string,
  enabled = true,
): UseHandwritingRecognition => {
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState<LayersModel | null>(null);
  const [tfModule, setTfModule] = useState<
    typeof import("@tensorflow/tfjs") | null
  >(null);
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const loadModel = async () => {
      if (!enabled) {
        setLoading(false);
        setModel(null);
        setModelError(null);
        return;
      }

      setLoading(true);
      setModelError(null);

      try {
        const tf = await import("@tensorflow/tfjs");
        const loaded = await tf.loadLayersModel(modelPath);
        if (!alive) {
          return;
        }
        setTfModule(tf);
        setModel(loaded);
      } catch {
        if (!alive) {
          return;
        }
        setModelError("Modello non trovato o non compatibile.");
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    void loadModel();

    return () => {
      alive = false;
    };
  }, [enabled, modelPath]);

  const predictFromCanvas = async (dataUrl: string): Promise<string | null> => {
    if (!model || !tfModule) {
      return null;
    }

    const image = await imageFromDataUrl(dataUrl);
    const offscreen = document.createElement("canvas");
    offscreen.width = 28;
    offscreen.height = 28;
    const context = offscreen.getContext("2d");
    if (!context) {
      return null;
    }

    context.fillStyle = "#000";
    context.fillRect(0, 0, 28, 28);
    context.drawImage(image, 0, 0, 28, 28);

    const imageData = context.getImageData(0, 0, 28, 28);
    const normalized = new Float32Array(28 * 28);

    for (let index = 0; index < 28 * 28; index += 1) {
      const pixel = imageData.data[index * 4];
      normalized[index] = pixel / 255;
    }

    const output = tfModule.tidy(() => {
      const tensor = tfModule.tensor4d(normalized, [1, 28, 28, 1]);
      return model.predict(tensor) as Tensor;
    });

    const logits = await output.data();
    output.dispose();

    let bestIndex = 0;
    for (let index = 1; index < logits.length; index += 1) {
      if (logits[index] > logits[bestIndex]) {
        bestIndex = index;
      }
    }

    return LETTERS[bestIndex] ?? null;
  };

  return {
    loading,
    modelReady: Boolean(model),
    modelError,
    predictFromCanvas,
  };
};
