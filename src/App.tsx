import { useCallback, useEffect, useMemo, useState } from "react";
import { ClueList } from "./components/ClueList/ClueList";
import { CrosswordGrid } from "./components/CrosswordGrid/CrosswordGrid";
import { HandwritingCanvas } from "./components/HandwritingCanvas/HandwritingCanvas";
import { PuzzleSelector } from "./components/PuzzleSelector/PuzzleSelector";
import { usePencilInput } from "./hooks/usePencilInput";
import {
  getFirstPlayableCell,
  getNextCell,
  getPreviousCell,
} from "./lib/crossword";
import { loadPuzzleById } from "./lib/puzzleLoader";
import { loadProgress, markPuzzleCompleted, saveProgress } from "./lib/storage";
import type {
  CrosswordCell,
  CrosswordClue,
  Direction,
  PuzzleData,
} from "./types/puzzle";

const HANDWRITING_ENABLED = false;

const createEmptyEntries = (puzzle: PuzzleData): CrosswordCell[][] =>
  puzzle.grid.map((row) => row.map((cell) => (cell === "#" ? "#" : "")));

function App() {
  const [activePuzzleId, setActivePuzzleId] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [entries, setEntries] = useState<CrosswordCell[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [direction, setDirection] = useState<Direction>("across");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [wrongCells, setWrongCells] = useState<Set<string>>(new Set());

  const modelReady = false;
  const loading = false;
  const modelError = null;

  const { penTarget, openPenInput, closePenInput } = usePencilInput();

  useEffect(() => {
    if (!activePuzzleId) {
      setPuzzle(null);
      setEntries([]);
      setSelectedCell(null);
      setDirection("across");
      setVerificationMessage("");
      setWrongCells(new Set());
      return;
    }

    let active = true;

    const loadPuzzle = async () => {
      const loadedPuzzle = await loadPuzzleById(activePuzzleId);
      if (!active || !loadedPuzzle) {
        return;
      }

      const saved = loadProgress(loadedPuzzle.id);
      setPuzzle(loadedPuzzle);
      setEntries(saved?.entries ?? createEmptyEntries(loadedPuzzle));
      setSelectedCell(getFirstPlayableCell(loadedPuzzle));
    };

    void loadPuzzle();

    return () => {
      active = false;
    };
  }, [activePuzzleId]);

  useEffect(() => {
    if (!puzzle) {
      return;
    }
    saveProgress(puzzle.id, entries);
  }, [entries, puzzle]);

  const activeClue = useMemo(() => {
    if (!puzzle || !selectedCell) {
      return null;
    }

    const found = puzzle.clues[direction].find((clue) => {
      if (clue.direction === "across") {
        return (
          clue.row === selectedCell.row &&
          selectedCell.col >= clue.col &&
          selectedCell.col < clue.col + clue.length
        );
      }

      return (
        clue.col === selectedCell.col &&
        selectedCell.row >= clue.row &&
        selectedCell.row < clue.row + clue.length
      );
    });

    return found ?? null;
  }, [direction, puzzle, selectedCell]);

  const activeCells = useMemo(() => {
    if (!activeClue) {
      return new Set<string>();
    }

    const keys = new Set<string>();
    for (let index = 0; index < activeClue.length; index += 1) {
      const row =
        activeClue.direction === "down"
          ? activeClue.row + index
          : activeClue.row;
      const col =
        activeClue.direction === "across"
          ? activeClue.col + index
          : activeClue.col;
      keys.add(`${row}:${col}`);
    }
    return keys;
  }, [activeClue]);

  const selectClue = (clue: CrosswordClue) => {
    setDirection(clue.direction);
    setSelectedCell({ row: clue.row, col: clue.col });
  };

  const selectCell = useCallback(
    (row: number, col: number) => {
      if (entries[row]?.[col] === "#") {
        return;
      }

      setVerificationMessage("");

      const isSameCell = selectedCell?.row === row && selectedCell?.col === col;
      if (isSameCell) {
        setDirection((current) => (current === "across" ? "down" : "across"));
      }

      setSelectedCell({ row, col });
    },
    [entries, selectedCell],
  );

  const updateCell = useCallback((row: number, col: number, value: string) => {
    setEntries((previous) =>
      previous.map((line, rowIndex) =>
        line.map((cell, colIndex) => {
          if (rowIndex !== row || colIndex !== col || cell === "#") {
            return cell;
          }

          return value;
        }),
      ),
    );

    setWrongCells((previous) => {
      if (!previous.has(`${row}:${col}`)) {
        return previous;
      }

      const next = new Set(previous);
      next.delete(`${row}:${col}`);
      return next;
    });
  }, []);

  const moveSelection = useCallback(
    (movement: "next" | "previous") => {
      if (!puzzle || !selectedCell) {
        return;
      }

      const candidate =
        movement === "next"
          ? getNextCell(puzzle, selectedCell, direction)
          : getPreviousCell(puzzle, selectedCell, direction);

      if (candidate) {
        setSelectedCell(candidate);
      }
    },
    [direction, puzzle, selectedCell],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!puzzle || !selectedCell) {
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();

        const currentValue = entries[selectedCell.row][selectedCell.col];
        if (currentValue !== "") {
          updateCell(selectedCell.row, selectedCell.col, "");
          return;
        }

        moveSelection("previous");
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        setDirection((current) => (current === "across" ? "down" : "across"));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setDirection("across");
        moveSelection("next");
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setDirection("across");
        moveSelection("previous");
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setDirection("down");
        moveSelection("next");
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setDirection("down");
        moveSelection("previous");
        return;
      }

      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        updateCell(selectedCell.row, selectedCell.col, event.key.toUpperCase());
        moveSelection("next");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [entries, moveSelection, puzzle, selectedCell, updateCell]);

  const verifyPuzzle = () => {
    if (!puzzle) {
      return;
    }

    let wrong = 0;
    let missing = 0;
    const nextWrongCells = new Set<string>();

    for (let row = 0; row < puzzle.size.rows; row += 1) {
      for (let col = 0; col < puzzle.size.cols; col += 1) {
        if (puzzle.grid[row][col] === "#") {
          continue;
        }

        const answer = puzzle.solution[row][col];
        const value = entries[row][col];

        if (!value) {
          missing += 1;
          continue;
        }

        if (answer !== value) {
          wrong += 1;
          nextWrongCells.add(`${row}:${col}`);
        }
      }
    }

    setWrongCells(nextWrongCells);

    if (missing === 0 && wrong === 0) {
      setVerificationMessage("Perfetto. Cruciverba completato correttamente.");
      markPuzzleCompleted(puzzle.id, entries);
      return;
    }

    setVerificationMessage(
      `Controllo completato: ${wrong} errori, ${missing} caselle vuote.`,
    );
  };

  const hintSelectedCell = () => {
    if (!puzzle || !selectedCell) {
      return;
    }

    const answer = puzzle.solution[selectedCell.row][selectedCell.col];
    if (answer === "#") {
      return;
    }

    updateCell(selectedCell.row, selectedCell.col, answer);
    setVerificationMessage("Hint applicato alla casella selezionata.");
  };

  const handlePenStroke = async (_dataUrl: string) => {
    void _dataUrl;

    if (!puzzle) {
      return;
    }

    if (!HANDWRITING_ENABLED) {
      setVerificationMessage(
        "Riconoscimento Apple Pencil disattivato per ora.",
      );
      closePenInput();
      return;
    }

    if (!penTarget) {
      return;
    }

    updateCell(penTarget.row, penTarget.col, "");
    setSelectedCell({ row: penTarget.row, col: penTarget.col });
    closePenInput();
    moveSelection("next");
  };

  const fillCount = useMemo(() => {
    if (!puzzle) {
      return { filled: 0, total: 0 };
    }

    let total = 0;
    let filled = 0;

    for (let row = 0; row < puzzle.size.rows; row += 1) {
      for (let col = 0; col < puzzle.size.cols; col += 1) {
        if (puzzle.grid[row][col] === "#") {
          continue;
        }

        total += 1;
        if (entries[row][col]) {
          filled += 1;
        }
      }
    }

    return { filled, total };
  }, [entries, puzzle]);

  if (!activePuzzleId) {
    return (
      <main className="layout">
        <header className="heroBar">
          <div>
            <h1>CruciPenna</h1>
            <p>Scegli un puzzle da risolvere.</p>
          </div>
        </header>
        <PuzzleSelector onSelect={(id) => setActivePuzzleId(id)} />
      </main>
    );
  }

  if (!puzzle) {
    return (
      <main className="layout">
        <header className="heroBar">
          <div>
            <h1>CruciPenna</h1>
            <p>Caricamento puzzle in corso...</p>
          </div>
        </header>
      </main>
    );
  }

  return (
    <main className="layout">
      <header className="heroBar">
        <div>
          <h1>CruciPenna</h1>
          <p>Cruciverba per iPad con input touch, tastiera e Apple Pencil.</p>
        </div>
        <div className="pillRow">
          <button
            type="button"
            className="backButton"
            onClick={() => setActivePuzzleId(null)}
          >
            ← Tutti i puzzle
          </button>
          <span className="pill">Puzzle {puzzle.id}</span>
          <span className="pill">
            Avanzamento {fillCount.filled}/{fillCount.total}
          </span>
          <span className="pill">
            Direzione {direction === "across" ? "Orizzontale" : "Verticale"}
          </span>
        </div>
      </header>

      <section className="board">
        <CrosswordGrid
          puzzle={puzzle}
          entries={entries}
          selectedCell={selectedCell}
          highlightedCells={activeCells}
          wrongCells={wrongCells}
          onCellPointerDown={(target) => {
            if (HANDWRITING_ENABLED && target.pointerType === "pen") {
              openPenInput(target);
              return;
            }
            selectCell(target.row, target.col);
          }}
        />

        <aside className="sidebar">
          <div className="statusCard">
            <h2>Stato input</h2>
            <p>
              Modello handwriting:{" "}
              {!HANDWRITING_ENABLED
                ? "disattivato"
                : loading
                  ? "caricamento..."
                  : modelReady
                    ? "pronto"
                    : "non disponibile"}
            </p>
            {modelError && <p className="errorText">{modelError}</p>}
            <button type="button" onClick={verifyPuzzle}>
              Verifica soluzione
            </button>
            <button
              type="button"
              className="secondaryAction"
              onClick={hintSelectedCell}
              disabled={!selectedCell}
            >
              Hint casella selezionata
            </button>
            {verificationMessage && <p>{verificationMessage}</p>}
          </div>

          <ClueList
            clues={puzzle.clues}
            activeClue={activeClue}
            onSelectClue={selectClue}
          />
        </aside>
      </section>

      <HandwritingCanvas
        penTarget={penTarget}
        onClose={closePenInput}
        onRecognize={handlePenStroke}
      />
    </main>
  );
}

export default App;
