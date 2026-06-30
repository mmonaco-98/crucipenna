import type { CrosswordClue, PuzzleData } from "../../types/puzzle";

interface ClueListProps {
  clues: PuzzleData["clues"];
  activeClue: CrosswordClue | null;
  onSelectClue: (clue: CrosswordClue) => void;
}

const renderSection = (
  title: string,
  list: CrosswordClue[],
  activeClue: CrosswordClue | null,
  onSelectClue: (clue: CrosswordClue) => void,
) => (
  <section className="clueCard">
    <h2>{title}</h2>
    <ol className="clueList">
      {list.map((clue) => (
        <li key={`${clue.direction}-${clue.number}`} className="clueItem">
          <button
            type="button"
            data-active={
              activeClue?.direction === clue.direction &&
              activeClue?.number === clue.number
            }
            onClick={() => onSelectClue(clue)}
          >
            {clue.number}. {clue.clue}
          </button>
        </li>
      ))}
    </ol>
  </section>
);

export function ClueList({ clues, activeClue, onSelectClue }: ClueListProps) {
  return (
    <>
      {renderSection("Orizzontali", clues.across, activeClue, onSelectClue)}
      {renderSection("Verticali", clues.down, activeClue, onSelectClue)}
    </>
  );
}
