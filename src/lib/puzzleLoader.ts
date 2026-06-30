import { puzzle001 } from "../data/puzzles/puzzle-001";
import type { PuzzleData } from "../types/puzzle";

export interface PuzzleMeta {
  id: string;
  title: string;
  size: { rows: number; cols: number };
}

const generatedModules = import.meta.glob(
  "../data/puzzles/generated/*.json",
) as Record<string, () => Promise<{ default: PuzzleData }>>;

const generatedEntries = Object.entries(generatedModules)
  .map(([path, loader]) => {
    const match = path.match(/puzzle-(\d+)\.json$/);
    return {
      id: match ? match[1] : "",
      loader,
    };
  })
  .filter((entry) => entry.id !== "")
  .sort((a, b) => a.id.localeCompare(b.id));

export const getAllPuzzleIds = (): string[] => {
  if (generatedEntries.length === 0) {
    return [puzzle001.id];
  }

  return generatedEntries.map((entry) => entry.id);
};

export const getDefaultPuzzleId = (): string => {
  const ids = getAllPuzzleIds();
  return ids[0];
};

export const loadPuzzleById = async (
  id: string,
): Promise<PuzzleData | null> => {
  const generated = generatedEntries.find((entry) => entry.id === id);
  if (generated) {
    const module = await generated.loader();
    return module.default;
  }

  if (id === puzzle001.id) {
    return puzzle001;
  }

  return null;
};

export const loadDefaultPuzzle = (): Promise<PuzzleData | null> =>
  loadPuzzleById(getDefaultPuzzleId());

export const loadAllPuzzlesMeta = async (): Promise<PuzzleMeta[]> => {
  if (generatedEntries.length === 0) {
    return [
      {
        id: puzzle001.id,
        title: puzzle001.title,
        size: puzzle001.size,
      },
    ];
  }

  const results = await Promise.all(
    generatedEntries.map(async (entry) => {
      const module = await entry.loader();
      const puzzle = module.default;
      return { id: puzzle.id, title: puzzle.title, size: puzzle.size };
    }),
  );
  return results;
};
