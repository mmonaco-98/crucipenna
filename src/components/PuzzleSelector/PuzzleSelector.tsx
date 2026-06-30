import { useEffect, useState } from "react";
import { loadAllPuzzlesMeta, type PuzzleMeta } from "../../lib/puzzleLoader";
import {
  getPuzzleProgressStatus,
  loadProgress,
  type PuzzleProgressStatus,
} from "../../lib/storage";
import "./PuzzleSelector.css";

interface Props {
  onSelect: (puzzleId: string) => void;
}

interface PuzzleWithStatus extends PuzzleMeta {
  status: PuzzleProgressStatus;
  updatedAt?: string;
  completionPercent?: number;
}

const getCompletionPercent = (
  entries: Array<Array<string | "#">> | undefined,
): number => {
  if (!entries) {
    return 0;
  }

  let total = 0;
  let filled = 0;

  for (const row of entries) {
    for (const cell of row) {
      if (cell === "#") {
        continue;
      }

      total += 1;
      if (cell) {
        filled += 1;
      }
    }
  }

  if (total === 0) {
    return 0;
  }

  return Math.round((filled / total) * 100);
};

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
  const [inProgressPuzzles, setInProgressPuzzles] = useState<
    PuzzleWithStatus[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    loadAllPuzzlesMeta().then((metas) => {
      if (!active) {
        return;
      }

      const map = new Map<string, PuzzleWithStatus[]>();
      const inProgress: PuzzleWithStatus[] = [];

      for (const meta of metas) {
        const saved = loadProgress(meta.id);
        const status = getPuzzleProgressStatus(meta.id);
        const puzzleWithStatus = {
          ...meta,
          status,
          updatedAt: saved?.updatedAt,
          completionPercent: getCompletionPercent(saved?.entries),
        };

        const key = `${meta.size.rows}×${meta.size.cols}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(puzzleWithStatus);

        if (status === "in-progress") {
          inProgress.push(puzzleWithStatus);
        }
      }

      const sorted = Array.from(map.entries())
        .map(([sizeKey, puzzles]) => ({ sizeKey, puzzles }))
        .sort((a, b) => {
          const [ar, ac] = a.sizeKey.split("×").map(Number);
          const [br, bc] = b.sizeKey.split("×").map(Number);
          return ar * ac - br * bc;
        });

      setGroups(sorted);
      setInProgressPuzzles(
        inProgress.sort((a, b) => {
          const aTime = Date.parse(a.updatedAt ?? "");
          const bTime = Date.parse(b.updatedAt ?? "");
          return (
            (Number.isNaN(bTime) ? 0 : bTime) -
            (Number.isNaN(aTime) ? 0 : aTime)
          );
        }),
      );
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
      {inProgressPuzzles.length > 0 && (
        <section className="inProgressSection">
          <div className="inProgressHeader">
            <h2>Continua puzzle in corso</h2>
            <span>{inProgressPuzzles.length} da completare</span>
          </div>
          <ul className="inProgressList">
            {inProgressPuzzles.map((puzzle) => (
              <li
                key={puzzle.id}
                className="inProgressItem"
                onClick={() => onSelect(puzzle.id)}
              >
                <div className="inProgressMeta">
                  <span className="inProgressTitle">{puzzle.title}</span>
                  <span className="inProgressSize">
                    Griglia {puzzle.size.rows}×{puzzle.size.cols}
                  </span>
                </div>
                <div className="inProgressRight">
                  <span className="inProgressPercent">
                    {puzzle.completionPercent ?? 0}%
                  </span>
                  <StatusBadge status={puzzle.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

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
