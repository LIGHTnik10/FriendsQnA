export interface Player {
  id: string;
  name: string;
  isHost: boolean;
}

export interface Vote {
  voterId: string;
  votedForId: string;
}

export interface Round {
  questionerId: string;
  question: string;
  votes: Vote[];
  results?: RoundResults;
}

export interface RoundResults {
  votes: { playerId: string; playerName: string; voteCount: number }[];
  mostVoted: string[];
}

export type GamePhase = 'lobby' | 'question-select' | 'voting' | 'results';

export interface GameState {
  lobbyCode: string;
  players: Player[];
  phase: GamePhase;
  currentRound: Round | null;
  currentQuestionerIndex: number;
  roundNumber: number;
  questionOptions: string[];
  resultsShownAt: number | null;
}

export const DEFAULT_QUESTIONS = [
  "Who is most likely to become famous?",
  "Who would survive longest in a zombie apocalypse?",
  "Who is the best secret keeper?",
  "Who would be the worst roommate?",
  "Who is most likely to win the lottery and lose the ticket?",
  "Who gives the best advice?",
  "Who is most likely to become a millionaire?",
  "Who is the biggest foodie?",
  "Who is most likely to go viral on social media?",
  "Who would make the best stand-up comedian?",
  "Who is most likely to cry during a movie?",
  "Who would win in a dance battle?",
  "Who is the most dramatic?",
  "Who tells the best stories?",
  "Who is most likely to forget an important date?",
];

export function getRandomQuestions(count: number = 3): string[] {
  const shuffled = [...DEFAULT_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
