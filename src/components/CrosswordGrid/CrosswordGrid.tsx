import type { PointerEvent } from "react";
import { Cell } from "../Cell/Cell";
import type {
  CellCoordinate,
  CrosswordCell,
  PenTarget,
  PuzzleData,
} from "../../types/puzzle";

interface CrosswordGridProps {
  puzzle: PuzzleData;
  entries: CrosswordCell[][];
  selectedCell: CellCoordinate | null;
  highlightedCells: Set<string>;
  wrongCells: Set<string>;
  onCellPointerDown: (target: PenTarget) => void;
}

const buildCellNumbers = (puzzle: PuzzleData): Map<string, number> => {
  const map = new Map<string, number>();
  const allClues = [...puzzle.clues.across, ...puzzle.clues.down];
  allClues.forEach((clue) => {
    map.set(`${clue.row}:${clue.col}`, clue.number);
  });
  return map;
};

export function CrosswordGrid({
  puzzle,
  entries,
  selectedCell,
  highlightedCells,
  wrongCells,
  onCellPointerDown,
}: CrosswordGridProps) {
  const numbers = buildCellNumbers(puzzle);

  const pointerDown = (
    row: number,
    col: number,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    onCellPointerDown({
      row,
      col,
      pointerType: event.pointerType,
    });
  };

  return (
    <div
      className="crosswordGrid"
      style={{
        gridTemplateColumns: `repeat(${puzzle.size.cols}, minmax(0, 1fr))`,
      }}
    >
      {puzzle.grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const key = `${rowIndex}:${colIndex}`;
          const blocked = cell === "#";
          const selected =
            selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
          const wrong = wrongCells.has(key);

          return (
            <Cell
              key={key}
              blocked={blocked}
              value={blocked ? "" : entries[rowIndex][colIndex]}
              selected={selected}
              highlighted={highlightedCells.has(key)}
              wrong={wrong}
              number={numbers.get(key)}
              onPointerDown={(event) => pointerDown(rowIndex, colIndex, event)}
            />
          );
        }),
      )}
    </div>
  );
}
