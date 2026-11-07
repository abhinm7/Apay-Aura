// Aura betting: best-of-3 tic-tac-toe for a stake. The rules are plain functions over
// a Game so the server applies them and the client can show what will happen.

import type { Friend } from "./queries";

export const MIN_STAKE = 10;
export const MAX_STAKE = 100_000;
export const ROUNDS = 3;
// First to this many round wins takes the pot.
export const WINS_NEEDED = 2;
// Each move must be made within this long, or the player loses the round.
export const TURN_SECONDS = 60;

export const EMPTY_BOARD = ".........";

export type BetStatus = "pending" | "active" | "finished" | "declined" | "cancelled";
export type Side = "challenger" | "opponent";
export type RoundResult = Side | "draw";

// The challenger plays X, the opponent O. Who starts alternates each round.
export type Game = {
  challengerId: string;
  opponentId: string;
  stake: number;
  status: BetStatus;
  board: string;
  round: number;
  turnId: string | null;
  challengerWins: number;
  opponentWins: number;
  lastBoard: string | null;
  lastResult: RoundResult | null;
  winnerId: string | null;
  forfeitBy: string | null;
};

// What a move (or timeout, or forfeit) changes: the new game and the aura paid out to each side.
export type Step = { next: Game; payout: Record<Side, number> };

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// "X" or "O" if that mark has three in a row, "draw" if the board is full, else null.
export function boardResult(board: string): "X" | "O" | "draw" | null {
  for (const [a, b, c] of LINES) {
    if (board[a] !== "." && board[a] === board[b] && board[a] === board[c]) return board[a] as "X" | "O";
  }
  return board.includes(".") ? null : "draw";
}

// The three winning cells, for highlighting.
export function winningLine(board: string): number[] | null {
  return LINES.find(([a, b, c]) => board[a] !== "." && board[a] === board[b] && board[a] === board[c]) ?? null;
}

export const starterOf = (g: Game, round: number) => (round % 2 === 1 ? g.challengerId : g.opponentId);
const otherOf = (g: Game, id: string) => (id === g.challengerId ? g.opponentId : g.challengerId);
const sideOf = (g: Game, id: string): Side => (id === g.challengerId ? "challenger" : "opponent");

// Closes the current round and either starts the next one or settles the match.
function endRound(g: Game, result: RoundResult, finalBoard: string): Step {
  const challengerWins = g.challengerWins + (result === "challenger" ? 1 : 0);
  const opponentWins = g.opponentWins + (result === "opponent" ? 1 : 0);
  const base = { ...g, challengerWins, opponentWins, lastBoard: finalBoard, lastResult: result };

  if (challengerWins >= WINS_NEEDED || opponentWins >= WINS_NEEDED || g.round >= ROUNDS) {
    const winner = challengerWins > opponentWins ? g.challengerId : opponentWins > challengerWins ? g.opponentId : null;
    const pot = g.stake * 2;
    return {
      next: { ...base, status: "finished", board: finalBoard, turnId: null, winnerId: winner },
      // A tie returns each stake.
      payout: winner
        ? { challenger: winner === g.challengerId ? pot : 0, opponent: winner === g.opponentId ? pot : 0 }
        : { challenger: g.stake, opponent: g.stake },
    };
  }
  const round = g.round + 1;
  return {
    next: { ...base, round, board: EMPTY_BOARD, turnId: starterOf(g, round) },
    payout: { challenger: 0, opponent: 0 },
  };
}

// Returns the step, or an error message.
export function playMove(g: Game, userId: string, cell: number): Step | string {
  if (g.status !== "active") return "This game isn't being played";
  if (g.turnId !== userId) return "It's not your turn";
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || g.board[cell] !== ".") return "Pick an empty square";

  const mark = userId === g.challengerId ? "X" : "O";
  const board = g.board.slice(0, cell) + mark + g.board.slice(cell + 1);
  const result = boardResult(board);
  if (!result) return { next: { ...g, board, turnId: otherOf(g, userId) }, payout: { challenger: 0, opponent: 0 } };
  return endRound(g, result === "draw" ? "draw" : result === "X" ? "challenger" : "opponent", board);
}

// The player whose turn it is ran out of time: they lose the round.
export function timeOut(g: Game): Step {
  return endRound(g, sideOf(g, otherOf(g, g.turnId!)), g.board);
}

// `userId` gives up: the other player takes the pot.
export function forfeit(g: Game, userId: string): Step {
  const winner = otherOf(g, userId);
  const pot = g.stake * 2;
  return {
    next: { ...g, status: "finished", turnId: null, winnerId: winner, forfeitBy: userId, lastBoard: g.board },
    payout: { challenger: winner === g.challengerId ? pot : 0, opponent: winner === g.opponentId ? pot : 0 },
  };
}

// A bet as one player sees it.
export type Bet = {
  id: string;
  stake: number;
  status: BetStatus;
  byMe: boolean; // I sent the challenge
  other: Friend;
  board: string;
  round: number;
  myMark: "X" | "O";
  myTurn: boolean;
  turnDeadline: string | null;
  myWins: number;
  theirWins: number;
  lastBoard: string | null;
  lastResult: "me" | "them" | "draw" | null;
  result: "won" | "lost" | "tie" | null;
  forfeitedByMe: boolean | null; // finished by a forfeit: who gave up
  version: number;
  createdAt: string;
};

export function validateStake(stake: number) {
  if (!Number.isInteger(stake) || stake < MIN_STAKE) return `Bet at least ✦ ${MIN_STAKE}`;
  if (stake > MAX_STAKE) return `You can bet at most ✦ ${MAX_STAKE.toLocaleString("en-IN")}`;
  return null;
}
