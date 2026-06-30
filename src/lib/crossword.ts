import type { CellCoordinate, Direction, PuzzleData } from "../types/puzzle";

const isPlayableCell = (
  puzzle: PuzzleData,
  row: number,
  col: number,
): boolean => {
  if (
    row < 0 ||
    col < 0 ||
    row >= puzzle.size.rows ||
    col >= puzzle.size.cols
  ) {
    return false;
  }

  return puzzle.grid[row][col] !== "#";
};

export const getFirstPlayableCell = (
  puzzle: PuzzleData,
): CellCoordinate | null => {
  for (let row = 0; row < puzzle.size.rows; row += 1) {
    for (let col = 0; col < puzzle.size.cols; col += 1) {
      if (isPlayableCell(puzzle, row, col)) {
        return { row, col };
      }
    }
  }

  return null;
};

const getDelta = (direction: Direction): CellCoordinate => {
  if (direction === "across") {
    return { row: 0, col: 1 };
  }

  return { row: 1, col: 0 };
};

export const getNextCell = (
  puzzle: PuzzleData,
  current: CellCoordinate,
  direction: Direction,
): CellCoordinate | null => {
  const delta = getDelta(direction);
  const row = current.row + delta.row;
  const col = current.col + delta.col;

  return isPlayableCell(puzzle, row, col) ? { row, col } : null;
};

export const getPreviousCell = (
  puzzle: PuzzleData,
  current: CellCoordinate,
  direction: Direction,
): CellCoordinate | null => {
  const delta = getDelta(direction);
  const row = current.row - delta.row;
  const col = current.col - delta.col;

  return isPlayableCell(puzzle, row, col) ? { row, col } : null;
};
