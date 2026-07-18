// Six FM routing algorithms for a 4-op engine.
// Each algorithm defines which operators are carriers (their output reaches the sum)
// and modulator connections (source op index -> destination op index).
// Operator indices: 0..3 (labelled OP1..OP4 in UI).

export interface Algorithm {
  id: number;
  name: string;
  carriers: number[]; // indices that route to output sum
  modulations: Array<[number, number]>; // [sourceIdx, destIdx]
  feedbackOp: number; // which op receives self-feedback
}

export const ALGORITHMS: Algorithm[] = [
  {
    id: 1,
    name: "4>3>2>1",
    carriers: [0],
    modulations: [
      [3, 2],
      [2, 1],
      [1, 0],
    ],
    feedbackOp: 3,
  },
  {
    id: 2,
    name: "4>(1,2,3)",
    carriers: [0, 1, 2],
    modulations: [
      [3, 0],
      [3, 1],
      [3, 2],
    ],
    feedbackOp: 3,
  },
  {
    id: 3,
    name: "4>3>2 | 1",
    carriers: [0, 1],
    modulations: [
      [3, 2],
      [2, 1],
    ],
    feedbackOp: 3,
  },
  {
    id: 4,
    name: "4>2 | 3>1",
    carriers: [0, 1],
    modulations: [
      [3, 1],
      [2, 0],
    ],
    feedbackOp: 3,
  },
  {
    id: 5,
    name: "4>1 | 3>1 | 2",
    carriers: [0, 1],
    modulations: [
      [3, 0],
      [2, 0],
    ],
    feedbackOp: 3,
  },
  {
    id: 6,
    name: "1+2+3+4",
    carriers: [0, 1, 2, 3],
    modulations: [],
    feedbackOp: 3,
  },
];
