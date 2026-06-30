import { useEffect, useState } from "react";
import { loadAllPuzzlesMeta, type PuzzleMeta } from "../../lib/puzzleLoader";
import {
  getPuzzleProgressStatus,
  type PuzzleProgressStatus,
} from "../../lib/storage";
import "./PuzzleSelector.css";

interface Props {
  onSelect: (puzzleId: string) => void;
}

interface PuzzleWithStatus extends PuzzleMeta {
  status: PuzzleProgressStatus;
}

const STATUS_LABELS: Record<PuzzleProgressStatus, string> = {
  "not-started": "Non iniziato",
  "in-progress": "In corso",
  completed: "Completato",
};

function StatusBadge({ status }: { status: PuzzleProgressStatus }) {
  return (
    <span className={`statusBadge statusBadge--${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PuzzleSelector({ onSelect }: Props) {
  const [groups, setGroups] = useState<
    Array<{ sizeKey: string; puzzles: PuzzleWithStatus[] }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    loadAllPuzzlesMeta().then((metas) => {
      if (!active) {
        return;
      }

      const map = new Map<string, PuzzleWithStatus[]>();
      for (const meta of metas) {
        const key = `${meta.size.rows}×${meta.size.cols}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push({
          ...meta,
          status: getPuzzleProgressStatus(meta.id),
        });
      }

      const sorted = Array.from(map.entries())
        .map(([sizeKey, puzzles]) => ({ sizeKey, puzzles }))
        .sort((a, b) => {
          const [ar, ac] = a.sizeKey.split("×").map(Number);
          const [br, bc] = b.sizeKey.split("×").map(Number);
          return ar * ac - br * bc;
        });

      setGroups(sorted);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="selectorLoading">Caricamento puzzle in corso…</p>;
  }

  return (
    <div className="puzzleSelector">
      {groups.map(({ sizeKey, puzzles }, index) => {
        const completedCount = puzzles.filter(
          (p) => p.status === "completed",
        ).length;
        const inProgressCount = puzzles.filter(
          (p) => p.status === "in-progress",
        ).length;
        const defaultOpen = index === 0 || inProgressCount > 0;

        return (
          <details key={sizeKey} className="selectorGroup" open={defaultOpen}>
            <summary className="selectorGroupTitle">
              <span className="selectorGroupLabel">Griglia {sizeKey}</span>
              <span className="selectorGroupCount">
                {completedCount}/{puzzles.length} completati
              </span>
              <span className="selectorGroupChevron">▾</span>
            </summary>
            <ul className="selectorList">
              {puzzles.map((puzzle) => (
                <li
                  key={puzzle.id}
                  className="selectorItem"
                  onClick={() => onSelect(puzzle.id)}
                >
                  <span className="selectorItemTitle">{puzzle.title}</span>
                  <StatusBadge status={puzzle.status} />
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
