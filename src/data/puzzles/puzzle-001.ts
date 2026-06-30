import type { PuzzleData } from "../../types/puzzle";

export const puzzle001: PuzzleData = {
  id: "001",
  title: "Puzzle Demo",
  size: { rows: 5, cols: 5 },
  grid: [
    ["", "", "", "", ""],
    ["", "#", "", "#", ""],
    ["", "", "", "", ""],
    ["", "#", "", "#", ""],
    ["", "", "", "", ""],
  ],
  solution: [
    ["A", "M", "O", "R", "E"],
    ["R", "#", "R", "#", "A"],
    ["T", "A", "C", "C", "A"],
    ["E", "#", "A", "#", "R"],
    ["P", "E", "N", "N", "A"],
  ],
  clues: {
    across: [
      {
        number: 1,
        clue: "Sentimento profondo (5)",
        row: 0,
        col: 0,
        length: 5,
        direction: "across",
      },
      {
        number: 3,
        clue: "Nel mezzo di taCCA (2)",
        row: 2,
        col: 1,
        length: 2,
        direction: "across",
      },
      {
        number: 5,
        clue: "Strumento da scrittura (5)",
        row: 4,
        col: 0,
        length: 5,
        direction: "across",
      },
    ],
    down: [
      {
        number: 1,
        clue: "Puoi farlo col dito o con la Pencil (5)",
        row: 0,
        col: 0,
        length: 5,
        direction: "down",
      },
      {
        number: 2,
        clue: "Ultimo tratto di amORe (3)",
        row: 0,
        col: 2,
        length: 5,
        direction: "down",
      },
      {
        number: 4,
        clue: "Vocale più comune (5)",
        row: 0,
        col: 4,
        length: 5,
        direction: "down",
      },
    ],
  },
};
