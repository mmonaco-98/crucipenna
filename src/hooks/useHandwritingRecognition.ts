import { useCallback, useEffect, useState } from "react";
import type { LayersModel, Tensor } from "@tensorflow/tfjs";

interface UseHandwritingRecognition {
  loading: boolean;
  modelReady: boolean;
  modelError: string | null;
  predictFromCanvas: (dataUrl: string) => Promise<string | null>;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const IMAGE_SIZE = 28;
const PIXELS = IMAGE_SIZE * IMAGE_SIZE;

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
  const [loading, setLoading] = useState(enabled);
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

  const predictFromCanvas = useCallback(
    async (dataUrl: string): Promise<string | null> => {
      if (!model || !tfModule) {
        return null;
      }

      const image = await imageFromDataUrl(dataUrl);
      const offscreen = document.createElement("canvas");
      offscreen.width = IMAGE_SIZE;
      offscreen.height = IMAGE_SIZE;
      const context = offscreen.getContext("2d", { willReadFrequently: true });
      if (!context) {
        return null;
      }

      context.fillStyle = "#fff";
      context.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
      context.drawImage(image, 0, 0, IMAGE_SIZE, IMAGE_SIZE);

      const imageData = context.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
      const normalized = new Float32Array(PIXELS);

      for (let index = 0; index < PIXELS; index += 1) {
        const pixel = imageData.data[index * 4];
        normalized[index] = 1 - pixel / 255;
      }

      const output = tfModule.tidy(() => {
        const tensor = tfModule.tensor4d(normalized, [
          1,
          IMAGE_SIZE,
          IMAGE_SIZE,
          1,
        ]);
        return model.predict(tensor) as Tensor;
      });

      const logits = await output.data();
      output.dispose();

      if (logits.length < LETTERS.length) {
        return null;
      }

      let bestIndex = 0;
      for (let index = 1; index < LETTERS.length; index += 1) {
        if (logits[index] > logits[bestIndex]) {
          bestIndex = index;
        }
      }

      return LETTERS[bestIndex] ?? null;
    },
    [model, tfModule],
  );

  return {
    loading,
    modelReady: Boolean(model),
    modelError,
    predictFromCanvas,
  };
};
