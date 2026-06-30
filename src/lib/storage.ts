import type { CrosswordCell } from "../types/puzzle";

export type PuzzleProgressStatus = "not-started" | "in-progress" | "completed";

interface StoredProgress {
  entries: CrosswordCell[][];
  completed?: boolean;
  updatedAt: string;
}

const keyForPuzzle = (puzzleId: string): string =>
  `crucipenna:progress:${puzzleId}`;

export const loadProgress = (puzzleId: string): StoredProgress | null => {
  const raw = localStorage.getItem(keyForPuzzle(puzzleId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredProgress;
    if (!parsed.entries) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveProgress = (
  puzzleId: string,
  entries: CrosswordCell[][],
): void => {
  const existing = loadProgress(puzzleId);
  const payload: StoredProgress = {
    entries,
    completed: existing?.completed ?? false,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(keyForPuzzle(puzzleId), JSON.stringify(payload));
};

export const markPuzzleCompleted = (
  puzzleId: string,
  entries: CrosswordCell[][],
): void => {
  const payload: StoredProgress = {
    entries,
    completed: true,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(keyForPuzzle(puzzleId), JSON.stringify(payload));
};

export const getPuzzleProgressStatus = (
  puzzleId: string,
): PuzzleProgressStatus => {
  const raw = localStorage.getItem(keyForPuzzle(puzzleId));
  if (!raw) {
    return "not-started";
  }
  try {
    const parsed = JSON.parse(raw) as StoredProgress;
    if (!parsed.entries) {
      return "not-started";
    }
    return parsed.completed ? "completed" : "in-progress";
  } catch {
    return "not-started";
  }
};
