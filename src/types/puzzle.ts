export type Direction = "across" | "down";

export type CrosswordCell = "#" | "" | string;

export interface CrosswordClue {
  number: number;
  clue: string;
  row: number;
  col: number;
  length: number;
  direction: Direction;
}

export interface PuzzleData {
  id: string;
  title: string;
  size: {
    rows: number;
    cols: number;
  };
  grid: ("#" | "")[][];
  solution: ("#" | string)[][];
  clues: {
    across: CrosswordClue[];
    down: CrosswordClue[];
  };
}

export interface CellCoordinate {
  row: number;
  col: number;
}

export interface PenTarget extends CellCoordinate {
  pointerType: string;
}
