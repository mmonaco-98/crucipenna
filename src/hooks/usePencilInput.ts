import { useState } from "react";
import type { PenTarget } from "../types/puzzle";

export const usePencilInput = () => {
  const [penTarget, setPenTarget] = useState<PenTarget | null>(null);

  const openPenInput = (target: PenTarget) => {
    setPenTarget(target);
  };

  const closePenInput = () => {
    setPenTarget(null);
  };

  return {
    penTarget,
    openPenInput,
    closePenInput,
  };
};
