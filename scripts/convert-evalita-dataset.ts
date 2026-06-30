import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface CliOptions {
  emptyGridsPath: string;
  goldGridsPath: string;
  cluesPath: string;
  outDir: string;
  limit: number;
}

interface RawClue {
  target?: string;
  clue?: string;
  row?: number;
  col?: number;
  length?: number;
  direction?: "A" | "D";
}

interface ConvertedPuzzle {
  id: string;
  title: string;
  size: { rows: number; cols: number };
  grid: ("#" | "")[][];
  solution: string[][];
  clues: {
    across: Array<{
      number: number;
      clue: string;
      row: number;
      col: number;
      length: number;
      direction: "across";
    }>;
    down: Array<{
      number: number;
      clue: string;
      row: number;
      col: number;
      length: number;
      direction: "down";
    }>;
  };
}

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);

  const get = (name: string, fallback = ""): string => {
    const index = args.indexOf(name);
    if (index === -1 || !args[index + 1]) {
      return fallback;
    }
    return args[index + 1];
  };

  return {
    emptyGridsPath: get("--empty", "data/evalita/train_grids_empty.txt"),
    goldGridsPath: get("--gold", "data/evalita/train_grids_gold.txt"),
    cluesPath: get("--clues", "data/evalita/train_cross_clues.jsonl"),
    outDir: get("--out", "src/data/puzzles/generated"),
    limit: Number.parseInt(get("--limit", "10"), 10),
  };
};

const normalizeDirection = (value: RawClue["direction"]): "across" | "down" => {
  if (value === "D") {
    return "down";
  }
  return "across";
};

const parseGridLine = (line: string): string[][] => {
  const normalized = line.replaceAll("'", '"');
  const parsed = JSON.parse(normalized) as string[][];

  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !Array.isArray(parsed[0])
  ) {
    throw new Error(`Formato griglia non valido: ${line}`);
  }

  return parsed;
};

const normalizeGrid = (rows: string[][]): ("#" | "")[][] =>
  rows.map((row) => row.map((cell) => (cell === "." ? "#" : "")));

const normalizeSolution = (rows: string[][]): string[][] =>
  rows.map((row) =>
    row.map((cell) => (cell === "." ? "#" : cell.toUpperCase())),
  );

const computeNumberMap = (grid: ("#" | "")[][]): Map<string, number> => {
  const map = new Map<string, number>();
  let number = 1;

  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      if (grid[row][col] === "#") {
        continue;
      }

      const startAcross = col === 0 || grid[row][col - 1] === "#";
      const startDown = row === 0 || grid[row - 1][col] === "#";
      if (startAcross || startDown) {
        map.set(`${row}:${col}`, number);
        number += 1;
      }
    }
  }

  return map;
};

const convert = async () => {
  const options = parseArgs();
  const [emptyRaw, goldRaw, cluesRaw] = await Promise.all([
    readFile(options.emptyGridsPath, "utf-8"),
    readFile(options.goldGridsPath, "utf-8"),
    readFile(options.cluesPath, "utf-8"),
  ]);

  const emptyLines = emptyRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const goldLines = goldRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const clueLines = cluesRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const count = Math.min(
    options.limit,
    emptyLines.length,
    goldLines.length,
    clueLines.length,
  );
  await mkdir(options.outDir, { recursive: true });

  for (let index = 0; index < count; index += 1) {
    const id = String(index + 1).padStart(3, "0");
    const emptyRows = parseGridLine(emptyLines[index]);
    const goldRows = parseGridLine(goldLines[index]);
    const grid = normalizeGrid(emptyRows);
    const solution = normalizeSolution(goldRows);
    const numberMap = computeNumberMap(grid);
    const clues = JSON.parse(clueLines[index]) as RawClue[];

    const across = clues
      .filter((clue) => normalizeDirection(clue.direction) === "across")
      .map((clue) => ({
        number: numberMap.get(`${clue.row ?? 0}:${clue.col ?? 0}`) ?? 0,
        clue: clue.clue ?? "Definizione mancante",
        row: clue.row ?? 0,
        col: clue.col ?? 0,
        length: clue.length ?? 0,
        direction: "across" as const,
      }))
      .sort((a, b) => a.number - b.number);

    const down = clues
      .filter((clue) => normalizeDirection(clue.direction) === "down")
      .map((clue) => ({
        number: numberMap.get(`${clue.row ?? 0}:${clue.col ?? 0}`) ?? 0,
        clue: clue.clue ?? "Definizione mancante",
        row: clue.row ?? 0,
        col: clue.col ?? 0,
        length: clue.length ?? 0,
        direction: "down" as const,
      }))
      .sort((a, b) => a.number - b.number);

    const puzzle: ConvertedPuzzle = {
      id,
      title: `Puzzle ${id}`,
      size: {
        rows: grid.length,
        cols: grid[0].length,
      },
      grid,
      solution,
      clues: {
        across,
        down,
      },
    };

    const outPath = path.join(options.outDir, `puzzle-${id}.json`);
    await writeFile(outPath, JSON.stringify(puzzle, null, 2), "utf-8");
  }

  console.log(`Convertiti ${count} puzzle in ${options.outDir}`);
};

void convert();
