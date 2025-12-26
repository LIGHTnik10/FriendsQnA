import { GameState, Player, Vote, getRandomQuestions } from "@/types/game";

// In-memory store (works for demo, for production use Vercel KV or database)
const games = new Map<string, GameState>();

export function createGameState(lobbyCode: string): GameState {
  return {
    lobbyCode,
    players: [],
    phase: "lobby",
    currentRound: null,
    currentQuestionerIndex: 0,
    roundNumber: 0,
    questionOptions: [],
    resultsShownAt: null,
  };
}

export function getGame(lobbyCode: string): GameState | null {
  return games.get(lobbyCode) || null;
}

export function createOrJoinGame(
  lobbyCode: string,
  playerId: string,
  playerName: string,
  isHost: boolean
): GameState {
  if (!games.has(lobbyCode)) {
    games.set(lobbyCode, createGameState(lobbyCode));
  }

  const game = games.get(lobbyCode)!;

  // Check if player already exists
  const existingPlayer = game.players.find((p) => p.id === playerId);
  if (!existingPlayer) {
    const player: Player = {
      id: playerId,
      name: playerName,
      isHost: isHost || game.players.length === 0,
    };
    game.players.push(player);
  }

  return game;
}

export function startGame(lobbyCode: string): GameState | null {
  const game = games.get(lobbyCode);
  if (!game || game.players.length < 2) return null;

  game.phase = "question-select";
  game.currentQuestionerIndex = 0;
  game.roundNumber = 1;
  game.questionOptions = getRandomQuestions(3);
  game.currentRound = {
    questionerId: game.players[0].id,
    question: "",
    votes: [],
  };

  return game;
}

export function submitQuestion(lobbyCode: string, question: string): GameState | null {
  const game = games.get(lobbyCode);
  if (!game || !game.currentRound) return null;

  game.currentRound.question = question;
  game.phase = "voting";

  return game;
}

export function submitVote(
  lobbyCode: string,
  voterId: string,
  votedForId: string
): GameState | null {
  const game = games.get(lobbyCode);
  if (!game || !game.currentRound) return null;

  // Check if already voted
  const existingVote = game.currentRound.votes.find((v) => v.voterId === voterId);
  if (existingVote) return game;

  game.currentRound.votes.push({ voterId, votedForId });

  // Check if all players have voted
  if (game.currentRound.votes.length === game.players.length) {
    calculateResults(game);
  }

  return game;
}

function calculateResults(game: GameState) {
  if (!game.currentRound) return;

  const voteCounts = new Map<string, number>();
  game.players.forEach((p) => voteCounts.set(p.id, 0));

  game.currentRound.votes.forEach((vote) => {
    const current = voteCounts.get(vote.votedForId) || 0;
    voteCounts.set(vote.votedForId, current + 1);
  });

  const results = game.players
    .map((p) => ({
      playerId: p.id,
      playerName: p.name,
      voteCount: voteCounts.get(p.id) || 0,
    }))
    .sort((a, b) => b.voteCount - a.voteCount);

  const maxVotes = results[0].voteCount;
  const mostVoted = results.filter((r) => r.voteCount === maxVotes).map((r) => r.playerId);

  game.currentRound.results = { votes: results, mostVoted };
  game.phase = "results";
  game.resultsShownAt = Date.now();
}

export function checkAndAdvanceRound(lobbyCode: string): GameState | null {
  const game = games.get(lobbyCode);
  if (!game || game.phase !== "results" || !game.resultsShownAt) return game || null;

  // Check if 15 seconds have passed
  if (Date.now() - game.resultsShownAt >= 15000) {
    game.currentQuestionerIndex = (game.currentQuestionerIndex + 1) % game.players.length;
    game.roundNumber++;
    game.phase = "question-select";
    game.questionOptions = getRandomQuestions(3);
    game.currentRound = {
      questionerId: game.players[game.currentQuestionerIndex].id,
      question: "",
      votes: [],
    };
    game.resultsShownAt = null;
  }

  return game;
}

export function endGame(lobbyCode: string): boolean {
  return games.delete(lobbyCode);
}

export function removePlayer(lobbyCode: string, playerId: string): GameState | null {
  const game = games.get(lobbyCode);
  if (!game) return null;

  game.players = game.players.filter((p) => p.id !== playerId);

  if (game.players.length === 0) {
    games.delete(lobbyCode);
    return null;
  }

  // Reassign host if needed
  if (!game.players.some((p) => p.isHost)) {
    game.players[0].isHost = true;
  }

  return game;
}
