import type { PointerEvent } from "react";

interface CellProps {
  row: number;
  col: number;
  value: string;
  blocked: boolean;
  selected: boolean;
  highlighted: boolean;
  wrong: boolean;
  number?: number;
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
}

export function Cell({
  row,
  col,
  value,
  blocked,
  selected,
  highlighted,
  wrong,
  number,
  onPointerDown,
}: CellProps) {
  const state = blocked
    ? "blocked"
    : selected
      ? "selected"
      : highlighted
        ? "active"
        : "idle";

  return (
    <button
      type="button"
      className="cell"
      data-state={state}
      data-wrong={wrong ? "true" : "false"}
      data-row={row}
      data-col={col}
      onPointerDown={onPointerDown}
      disabled={blocked}
      aria-label={blocked ? "casella nera" : `casella ${number ?? ""}`}
    >
      {number && <span className="cellNumber">{number}</span>}
      {!blocked && <span className="cellValue">{value}</span>}
    </button>
  );
}
